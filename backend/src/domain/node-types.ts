export const NODE_TYPES = ['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM', 'USER'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const MOVEABLE_NODE_TYPES = ['DEPARTMENT', 'TEAM', 'USER'] as const;
export type MoveableNodeType = (typeof MOVEABLE_NODE_TYPES)[number];

export const MOVE_PARENT_TYPES = ['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM'] as const;
export type MoveParentType = (typeof MOVE_PARENT_TYPES)[number];
