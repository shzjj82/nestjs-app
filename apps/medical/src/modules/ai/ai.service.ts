import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AgentsClient } from '@app/common';
import type { ChatMessage } from '../../lib/tcm-agents';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PatientsService } from '../patients/patients.service';
import { VisitsService } from '../patients/visits.service';
import { pick, toArray } from '../../common/payload';

export interface AdviseResult {
  mode: 'llm' | 'rule_based' | 'rule_based_fallback';
  safetyAlerts: string[];
  plan?: Record<string, unknown>;
  external: Array<Record<string, unknown>>;
  internal: Array<Record<string, unknown>>;
  cases: Array<Record<string, unknown>>;
  disclaimer: string;
}

const EMERGENCY_FLAGS = [
  '胸痛剧烈', '意识障碍', '昏迷', '大出血', '急腹症', '剧烈腹痛',
  '卒中', '偏瘫失语', '呼吸困难', '高热不退', '妊娠', '孕妇',
  '十八反', '十九畏',
];

const DISCLAIMER = '本内容由 AI 辅助生成，须经执业医师审核后使用，不得直接作为处方交付患者。';

export type ChatReply = {
  mode: 'llm' | 'rule_based' | 'rule_based_fallback';
  conclusion: string;
  evidence: string[];
  citations: Array<{ kind: string; title: string; note?: string }>;
  risks: string[];
  missing: string[];
  disclaimer: string;
};

export type ChatStreamEvent = { delta: string } | { reply: ChatReply };

const CHAT_SYSTEM = `你是中医诊所里给医生用的助手，不直接面向患者。
规则：
1. 区分档案事实、医生记录和你的推测，推测必须标明；
2. 只依据【资料范围】作答；没有依据时写明「模型通用知识，无本地资料支持」，禁止伪造文献、页码或医案编号；
3. 治疗建议必须带来源；内部医案须说明样本量局限；
4. 高风险、急重症、禁忌必须提醒医生复核；
5. 不得给出患者可直接执行的侵入性操作指导；
6. 直接写答复正文，不要输出 JSON，不要用代码块包裹。`;

const ADVISE_SYSTEM = `你是给中医师提供决策支持的助手（不直接面向患者开方）。
规则：
1. 只依据【参考资料】作答，每条建议用 [来源ID] 标注出处；
2. 资料不足时写"证据不足，建议上级医师会诊"，不要发挥；
3. 先输出安全红线自查结论；
4. 只输出 JSON 对象。`;

const PARSE_SYSTEM = `你是资深中医师兼病案管理员，把口语化的接诊记录整理为规范门诊病历。
不确定字段填 null 并在 uncertainFields 列出，绝不臆造剂量与既往史。只输出 JSON。`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly patients: PatientsService,
    private readonly visits: VisitsService,
    private readonly agents: AgentsClient,
  ) {}

  async status() {
    try {
      const ai = await this.agents.status();
      return { ...ai, asr: 'agents', vision: 'agents' };
    } catch {
      return { enabled: false, asr: 'agents', vision: 'agents' };
    }
  }

  /** 联合「外部参考库 + 内部资料库 + 本院高疗效医案」给出治疗建议。 */
  async recommend(input: { text?: string; patientId?: string; topK?: number }): Promise<AdviseResult> {
    const topK = input.topK ?? 5;
    let caseText = input.text ?? '';
    let patientRef: string | undefined;

    if (input.patientId) {
      const patient = await this.patients.findOne(input.patientId);
      patientRef = patient.externalId ?? patient.id;
      const initial = (patient.initialCondition ?? {}) as Record<string, any>;
      const current = (patient.currentCondition ?? initial) as Record<string, any>;
      caseText = [
        `姓名：${patient.name}　性别：${patient.gender ?? '-'}　年龄：${patient.age ?? '-'}`,
        `已诊疗：${patient.visitCount} 次`,
        `主诉：${initial.chief_complaint ?? initial.chiefComplaint ?? '-'}`,
        `现病史：${initial.present_illness ?? initial.presentIllness ?? '-'}`,
        `当前情况：${current.summary ?? '-'}`,
        `中医病名：${current.tcm_disease ?? current.tcmDisease ?? '-'}　证型：${current.tcm_syndrome ?? current.tcmSyndrome ?? '-'}`,
        `舌脉：${current.tongue ?? '-'}　${current.pulse ?? '-'}`,
        `严重度：${current.severity_score ?? current.severityScore ?? '-'}`,
        input.text ? `补充说明：${input.text}` : '',
      ].join('\n');
    }

    const [external, internal, visits] = await Promise.all([
      this.knowledge.searchExternal(caseText, topK),
      this.knowledge.searchInternal(caseText, topK),
      patientRef ? this.visits.listForPatient(patientRef).catch(() => []) : Promise.resolve([]),
    ]);

    const cases = visits.slice(-5).map((visit) => ({
      ref: `CASE-${patientRef}#V${visit.visitNo}`,
      date: visit.date,
      summary: String(pick(visit.parsed ?? {}, ['treatment_principle', 'treatmentPrinciple']) ?? ''),
      doctorNote: visit.doctorNote ?? '',
    }));

    const safetyAlerts = EMERGENCY_FLAGS.filter((flag) => caseText.includes(flag));
    const result: AdviseResult = {
      mode: 'rule_based',
      safetyAlerts,
      external: external.map((r) => r.payload),
      internal: internal.map((r) => r.payload),
      cases,
      disclaimer: DISCLAIMER,
    };

    try {
      const plan = await this.extractViaAgents(
        ADVISE_SYSTEM,
        [
          '【病人情况】\n' + caseText,
          '【外部治疗参考资料库】\n' + JSON.stringify(result.external).slice(0, 8000),
          '【内部治疗资料库】\n' + JSON.stringify(result.internal).slice(0, 8000),
          '【本院相似医案】\n' + JSON.stringify(cases).slice(0, 4000),
          '输出 JSON：{caseProfile:{tcmDisease,tcmSyndrome,keySymptoms},safetyAlerts:[],treatmentPrinciple,acupuncturePlan:[{point,manipulation,retentionMin,rationale,source}],herbalPlan:[{formula,modification,source}],lifestyleAdvice:[],followupPlan,evidenceSummary:{externalHits,internalHits,caseHits,insufficientFields},confidence}',
        ].join('\n\n'),
        'medical',
        undefined,
        true,
      );
      result.plan = plan;
      result.mode = 'llm';
      return result;
    } catch (error) {
      this.logger.warn(`AI 建议生成失败，降级为检索草稿: ${String(error)}`);
      result.mode = 'rule_based_fallback';
      result.plan = {
        note: 'AI 生成失败，以下仅为资料库命中结果。',
        error: String(error).slice(0, 300),
        acupuncturePlan: internal.flatMap((row) => toArray(pick(row.payload, ['acupoints'])).map((p) => ({
          point: p, source: row.id,
        }))),
      };
      return result;
    }
  }

  /** 医生对话：按勾选范围检索患者记录和知识库，回答必须带来源。 */
  async chat(input: {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    patientId?: string;
    scopes?: { patient?: boolean; internal?: boolean; external?: boolean };
    answerMode?: 'summary' | 'review' | 'advise' | 'teach';
  }): Promise<ChatReply> {
    let last: ChatReply | undefined;
    for await (const event of this.chatStream(input)) {
      if ('reply' in event) last = event.reply;
    }
    if (!last) throw new BadRequestException('对话没有返回结果');
    return last;
  }

  /** SSE 逐字输出结论，结束时带上来源。 */
  async *chatStream(input: {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    patientId?: string;
    scopes?: { patient?: boolean; internal?: boolean; external?: boolean };
    answerMode?: 'summary' | 'review' | 'advise' | 'teach';
  }): AsyncGenerator<ChatStreamEvent> {
    const prepared = await this.prepareChat(input);
    if (!prepared.messages) {
      yield { reply: prepared.fallback };
      return;
    }
    const system = prepared.messages.find((item) => item.role === 'system')?.content;
    const dialog = prepared.messages
      .filter((item): item is { role: 'user' | 'assistant'; content: string } =>
        item.role === 'user' || item.role === 'assistant',
      )
      .map((item) => ({ role: item.role, content: item.content }));
    let conclusion = '';
    try {
      for await (const delta of this.agents.streamChat({
        bizCode: 'medical',
        system,
        messages: dialog,
        temperature: 0.2,
      })) {
        conclusion += delta;
        yield { delta };
      }
      yield {
        reply: {
          mode: 'llm',
          conclusion: conclusion.trim() || prepared.fallback.conclusion,
          evidence: prepared.fallback.evidence,
          citations: prepared.fallback.citations,
          risks: prepared.fallback.risks,
          missing: [],
          disclaimer: DISCLAIMER,
        },
      };
    } catch (error) {
      this.logger.warn(`AI 对话失败，降级为检索草稿: ${String(error)}`);
      if (conclusion.trim()) {
        yield {
          reply: {
            mode: 'llm',
            conclusion: conclusion.trim(),
            evidence: prepared.fallback.evidence,
            citations: prepared.fallback.citations,
            risks: prepared.fallback.risks,
            missing: [`生成中断：${String(error).slice(0, 80)}`],
            disclaimer: DISCLAIMER,
          },
        };
        return;
      }
      yield {
        reply: {
          ...prepared.fallback,
          mode: 'rule_based_fallback',
          missing: [`模型暂不可用：${String(error).slice(0, 80)}`],
        },
      };
    }
  }

  private async prepareChat(input: {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    patientId?: string;
    scopes?: { patient?: boolean; internal?: boolean; external?: boolean };
    answerMode?: 'summary' | 'review' | 'advise' | 'teach';
  }): Promise<{ messages: ChatMessage[] | null; fallback: ChatReply }> {
    const question = String(input.message ?? '').trim();
    if (!question) throw new BadRequestException('请输入问题');
    const scopes = {
      patient: Boolean(input.scopes?.patient && input.patientId),
      internal: input.scopes?.internal !== false,
      external: input.scopes?.external !== false,
    };
    const answerMode = input.answerMode ?? 'summary';
    const teach = answerMode === 'teach';

    let patientBlock = '';
    let patientLabel = '';
    if (scopes.patient && input.patientId) {
      try {
        const patient = await this.patients.findOne(input.patientId);
        const key = patient.externalId ?? patient.id;
        const name = teach ? `${String(patient.name || '某').slice(0, 1)}某` : patient.name;
        patientLabel = name;
        const initial = (patient.initialCondition ?? {}) as Record<string, unknown>;
        const current = (patient.currentCondition ?? initial) as Record<string, unknown>;
        const visits = await this.visits.listForPatient(key).catch(() => []);
        patientBlock = [
          `患者：${name}　${patient.gender ?? ''}　${patient.age ?? ''}岁`.trim(),
          `已诊疗 ${patient.visitCount} 次`,
          `主诉：${pick(initial, ['chief_complaint', 'chiefComplaint']) ?? '—'}`,
          `现病史：${pick(initial, ['present_illness', 'presentIllness']) ?? '—'}`,
          `当前：${pick(current, ['summary']) ?? '—'}`,
          `病名：${pick(current, ['tcm_disease', 'tcmDisease']) ?? '—'}　证型：${pick(current, ['tcm_syndrome', 'tcmSyndrome']) ?? '—'}`,
          ...visits.slice(-6).map((visit) => `第${visit.visitNo}次 ${String(visit.date).slice(0, 10)} ${visit.doctorNote || pick(visit.parsed ?? {}, ['treatment_principle', 'treatmentPrinciple']) || ''}`),
        ].join('\n');
      } catch {
        patientBlock = '';
      }
    }

    const query = [question, patientBlock].filter(Boolean).join('\n');
    const [external, internal] = await Promise.all([
      scopes.external ? this.knowledge.searchExternal(query, 5) : Promise.resolve([]),
      scopes.internal ? this.knowledge.searchInternal(query, 5) : Promise.resolve([]),
    ]);
    const citations = [
      ...(scopes.patient && patientLabel ? [{ kind: 'patient', title: `患者记录 ${patientLabel}`, note: '当前患者已确认信息' }] : []),
      ...internal.map((row) => ({ kind: 'internal', title: row.title, note: '已审核内部资料' })),
      ...external.map((row) => ({ kind: 'external', title: row.title, note: '外部治疗参考资料' })),
    ];
    const risks = EMERGENCY_FLAGS.filter((flag) => query.includes(flag));
    const fallback: ChatReply = {
      mode: 'rule_based',
      conclusion: citations.length
        ? '未配置或未调用模型，以下为资料库检索结果，请医生自行判断。'
        : '当前范围没有可引用的本地资料。',
      evidence: [
        ...internal.slice(0, 3).map((row) => `内部：${row.title}`),
        ...external.slice(0, 3).map((row) => `外部：${row.title}`),
      ],
      citations: citations.length ? citations : [{ kind: 'model', title: '模型通用知识', note: '无本地资料支持' }],
      risks,
      missing: citations.length ? [] : ['请勾选资料范围，或指定一位患者'],
      disclaimer: DISCLAIMER,
    };

    const modeHint = {
      summary: '用简洁条目概括，不要展开处方。',
      review: '做临床复盘：变化、方案调整、未改善项和下次追问，不直接给处方。',
      advise: '给治疗参考，每条必须带来源；无来源须标明模型通用知识。',
      teach: '用教学口吻，患者信息必须脱敏，不出现可识别身份。',
    }[answerMode];
    const history = (input.history ?? []).slice(-8).map((item) => ({
      role: item.role,
      content: item.content.slice(0, 2000),
    }));
    return {
      fallback,
      messages: [
        { role: 'system', content: CHAT_SYSTEM },
        ...history,
        {
          role: 'user',
          content: [
            `【回答模式】${modeHint}`,
            scopes.patient && patientBlock ? `【当前患者】\n${patientBlock}` : '【当前患者】未指定，不得编造患者。',
            scopes.internal ? `【内部治疗资料库】\n${JSON.stringify(internal.map((row) => ({ id: row.id, title: row.title }))).slice(0, 6000)}` : '【内部治疗资料库】未纳入本次检索。',
            scopes.external ? `【外部治疗参考资料库】\n${JSON.stringify(external.map((row) => ({ id: row.id, title: row.title }))).slice(0, 6000)}` : '【外部治疗参考资料库】未纳入本次检索。',
            `【问题】\n${question}`,
            '请直接写答复正文。',
          ].join('\n\n'),
        },
      ],
    };
  }

  /** 把一段医生口述/录音转写解析成结构化医案。可用于前端预览后再落库。 */
  async parseNote(input: { text?: string; doctorNote?: string }) {
    const material = input.doctorNote || input.text || '';
    if (!material) throw new Error('缺少待解析内容');
    try {
      return await this.extractViaAgents(
        PARSE_SYSTEM,
        `素材：\n${material}\n\n输出结构：{visitDate,narrative,tcmDisease,tcmSyndrome,treatmentPrinciple,symptoms:[],tongue,pulse,acupoints:[{name,manipulation,retentionMin,rationale}],prescriptions:[{name,composition}],advice:[],nextPlan,uncertainFields:[]}`,
        'medical',
      );
    } catch (error) {
      throw new BadRequestException(agentMessage(error, 'AI 解析暂时不可用，请稍后重试或手工填写'));
    }
  }

  /**
   * 录音文件先转写，再拆进主诉字段。ASR 和语言抽取都走 agents，本服务只组诊所字段。
   */
  async transcribeIntake(input: {
    audioBase64?: string;
    mime?: string;
    fileUrl?: string;
    provider?: string;
    transcript?: string;
    bizCode?: string;
    accountId?: string;
  }) {
    const bizCode = input.bizCode || 'medical';
    const spoken = (input.transcript ?? '').trim();
    if (!input.audioBase64 && !input.fileUrl && spoken) {
      const fields = await this.parseIntake(spoken, bizCode, input.accountId);
      return { transcript: spoken, fields };
    }
    let transcribed: { transcript?: string; jobId?: string; status?: string; provider?: string };
    try {
      transcribed = await this.agents.transcribe({
        bizCode,
        audioBase64: input.audioBase64,
        mime: input.mime,
        fileUrl: input.fileUrl,
        provider: input.provider,
        accountId: input.accountId,
      });
    } catch (error) {
      throw new BadRequestException(agentMessage(error, '语音识别暂时不可用，请稍后重试或改为文字填写'));
    }
    if (transcribed.jobId && !transcribed.transcript) {
      return { jobId: transcribed.jobId, status: transcribed.status, provider: transcribed.provider };
    }
    const transcript = (transcribed.transcript ?? '').trim();
    if (!transcript) throw new BadRequestException('没有识别到语音内容');
    const fields = await this.parseIntake(transcript, bizCode, input.accountId);
    return { transcript, fields };
  }

  async getMediaJob(id: string, bizCode = 'medical') {
    try {
      return await this.agents.getMediaJob({ bizCode, id });
    } catch (error) {
      throw new BadRequestException(agentMessage(error, '查询转写任务失败'));
    }
  }

  async parseIntake(transcript: string, bizCode = 'medical', accountId?: string) {
    const material = transcript.trim();
    if (!material) throw new BadRequestException('没有识别到语音内容');
    try {
      const parsed = await this.extractViaAgents(
        INTAKE_PARSE_SYSTEM,
        `口述：\n${material.slice(0, 8000)}\n\n按系统说明输出 JSON。`,
        bizCode,
        accountId,
      );
      return normalizeIntake(parsed);
    } catch (error) {
      this.logger.warn(`主诉解析失败: ${String(error).slice(0, 300)}`);
      throw new BadRequestException('录音已识别，但整理成病历字段失败，请稍后重试或手工填写');
    }
  }

  /** 按页签从文字里摘字段。没提到的留空，不推测。 */
  async extractSection(input: { text?: string; section?: string; bizCode?: string; accountId?: string }) {
    const text = (input.text ?? '').trim();
    if (!text) throw new BadRequestException('没有可解析的内容');
    const section = input.section === 'condition' || input.section === 'plan' ? input.section : 'chart';
    try {
      const parsed = await this.extractViaAgents(
        EXTRACT_SYSTEM[section],
        `材料：\n${text.slice(0, 8000)}`,
        input.bizCode || 'medical',
        input.accountId,
      );
      const fields = Object.fromEntries(
        EXTRACT_KEYS[section].map((key) => [key, typeof parsed[key] === 'string' ? parsed[key].trim() : '']),
      );
      return { section, fields };
    } catch (error) {
      this.logger.warn(`页签解析失败: ${String(error).slice(0, 300)}`);
      throw new BadRequestException(agentMessage(error, '解析暂时不可用，请稍后重试或手工填写'));
    }
  }

  private async extractViaAgents(
    system: string,
    user: string,
    bizCode: string,
    accountId?: string,
    reasoner = false,
  ) {
    const result = await this.agents.extract({
      bizCode,
      system,
      user,
      temperature: 0.1,
      reasoner,
      accountId,
    });
    const parsed = result.fields && Object.keys(result.fields).length ? result.fields : asObject(result.json);
    if (!parsed) throw new Error('语言模型没有返回 JSON');
    return parsed;
  }

  /** 对照上次已确认记录，只返回本次材料里写明的变化。 */
  async compareVisit(input: { previous?: string; current?: string }) {
    const current = (input.current ?? '').trim();
    if (!current) throw new BadRequestException('请先填写本次情况');
    const previous = (input.previous ?? '').trim() || '（没有上次记录）';
    let parsed: Record<string, unknown>;
    try {
      parsed = await this.extractViaAgents(
        COMPARE_SYSTEM,
        `上次：\n${previous.slice(0, 4000)}\n\n本次：\n${current.slice(0, 4000)}`,
        'medical',
      );
    } catch (error) {
      this.logger.warn(`病情对比失败: ${String(error).slice(0, 300)}`);
      throw new BadRequestException(agentMessage(error, '对比暂时不可用，请稍后重试或手工记录变化'));
    }
    return {
      improved: textList(parsed.improved),
      worsened: textList(parsed.worsened),
      added: textList(parsed.added),
      resolved: textList(parsed.resolved),
      unchanged: textList(parsed.unchanged),
    };
  }

  /** 按本次材料生成摘要，医生可改后再写入档案。 */
  async summarizeVisit(input: { previous?: string; current?: string }) {
    const current = (input.current ?? '').trim();
    if (!current) throw new BadRequestException('请先填写本次情况');
    const previous = (input.previous ?? '').trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = await this.extractViaAgents(
        SUMMARY_SYSTEM,
        `${previous ? `上次：\n${previous.slice(0, 3000)}\n\n` : ''}本次：\n${current.slice(0, 4000)}`,
        'medical',
      );
    } catch (error) {
      this.logger.warn(`病情摘要失败: ${String(error).slice(0, 300)}`);
      throw new BadRequestException(agentMessage(error, '摘要暂时不可用，请手工填写'));
    }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summary) throw new BadRequestException('没有生成摘要，请手工填写');
    return { summary };
  }

}

const COMPARE_SYSTEM = `你对照上次病情和本次口述，只摘本次明确说到的变化。
规则：
1. 只根据【本次】里写明的内容判断，没提到的不要填；
2. improved 是好转，worsened 是加重，added 是新增，resolved 是消失，unchanged 是无明显变化；
3. unchanged 仅当本次明确写到该症状/体征仍在，或写明「无明显变化/同前」时才填；上次有而本次完全没提的，不要放进任何一类；
4. 每类是字符串数组，没有就给空数组；
5. 禁止推测、补充或编造；
6. 只输出 JSON 对象。`;

const SUMMARY_SYSTEM = `你根据本次就诊材料写一段病情摘要，供医生修改。
规则：
1. 只写材料里有的内容，不补充、不推测；
2. 用一段中文，不要编号；
3. 只输出 JSON：{"summary":"..."}。`;

const EXTRACT_KEYS = {
  chart: ['chiefComplaint', 'presentIllness'],
  condition: ['symptoms', 'tongue', 'pulse'],
  plan: ['westernDiagnosis', 'tcmDisease', 'tcmSyndrome', 'principle', 'acupoints', 'prescriptions', 'lifestyle'],
} as const;

const EXTRACT_SYSTEM = {
  chart: `从材料里摘主诉和现病史。只写材料里明确说到的内容，没提到的用空字符串。不要补充、推测。只输出 JSON：{"chiefComplaint":"","presentIllness":""}。`,
  condition: `从材料里摘目前症状、舌象、脉象。只写材料里明确说到的内容，没提到的用空字符串。不要补充、推测。只输出 JSON：{"symptoms":"","tongue":"","pulse":""}。`,
  plan: `从材料里摘诊断和治疗方案。只写材料里明确说到的内容，没提到的用空字符串。不要补充、推测。只输出 JSON：{"westernDiagnosis":"","tcmDisease":"","tcmSyndrome":"","principle":"","acupoints":"","prescriptions":"","lifestyle":""}。`,
} as const;

const INTAKE_PARSE_SYSTEM = `你是病案整理助手。把医生口述拆成门诊主诉字段。
规则：
1. 只摘口述里明确说到的内容，没提到的字段用空字符串，禁止补充、推测或编造；
2. 只输出 JSON 对象，键为：chiefComplaint,presentIllness,menstrualHistory,dailyCondition,tongue,pulse,signs,westernDiagnosis,tcmDisease,tcmSyndrome。不要输出既往史、家族史、过敏史、用药史、手术史，也不要输出检验、检查资料。`;

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function agentMessage(error: unknown, fallback: string): string {
  if (error instanceof BadRequestException) return String(error.message);
  const payload = error as { message?: string };
  return payload?.message || fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIntake(parsed: Record<string, unknown>) {
  return {
    chiefComplaint: cleanText(parsed.chiefComplaint),
    presentIllness: cleanText(parsed.presentIllness),
    menstrualHistory: cleanText(parsed.menstrualHistory),
    dailyCondition: cleanText(parsed.dailyCondition),
    tongue: cleanText(parsed.tongue),
    pulse: cleanText(parsed.pulse),
    signs: cleanText(parsed.signs),
    westernDiagnosis: cleanText(parsed.westernDiagnosis),
    tcmDisease: cleanText(parsed.tcmDisease),
    tcmSyndrome: cleanText(parsed.tcmSyndrome),
  };
}
