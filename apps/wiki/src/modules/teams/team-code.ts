import { randomInt } from 'crypto';

/** 去掉易混字符，方便口头转告 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const TEAM_CODE_LENGTH = 6;

/** 每次调用都新生成，不接受调用方指定 */
export function generateTeamCode(): string {
  let code = '';
  for (let i = 0; i < TEAM_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
