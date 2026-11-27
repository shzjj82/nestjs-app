import { CategoryEntity } from '../modules/categories/entity/category.entity';
import { DocumentEntity } from '../modules/documents/entity/document.entity';
import { WikiOpEventEntity } from '../modules/oplog/entity/wiki-op-event.entity';
import { WikiShareFavoriteEntity } from '../modules/shares/entity/wiki-share-favorite.entity';
import { WikiShareEntity } from '../modules/shares/entity/wiki-share.entity';
import { TeamMemberEntity } from '../modules/teams/entity/team-member.entity';
import { TeamEntity } from '../modules/teams/entity/team.entity';

export const WIKI_ENTITIES = [
  CategoryEntity,
  DocumentEntity,
  TeamEntity,
  TeamMemberEntity,
  WikiShareEntity,
  WikiShareFavoriteEntity,
  WikiOpEventEntity,
];

export {
  CategoryEntity,
  DocumentEntity,
  TeamEntity,
  TeamMemberEntity,
  WikiShareEntity,
  WikiShareFavoriteEntity,
  WikiOpEventEntity,
};
