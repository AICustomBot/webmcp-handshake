export type ProposalStatus='pending_human'|'approved'|'rejected'|'applied'|'expired'|'superseded'|'invalidated';
export type Operation={type:'place';productId:string;x:number;y:number;rotation:0|90|180|270}|{type:'move';itemId:string;x:number;y:number;rotation:0|90|180|270}|{type:'swap';itemId:string;replacementProductId:string};
export interface RoomState{sessionId:string;version:number;widthIn:number;lengthIn:number;budgetCents:number;items:RoomItem[]}
export interface RoomItem{id:string;productId:string;x:number;y:number;rotation:0|90|180|270}
export interface Proposal{id:string;baseVersion:number;hash:string;status:ProposalStatus;operations:Operation[];createdAt:string;expiresAt:string}
export type ToolResult<T>={ok:true;data:T;requestId:string}|{ok:false;error:{code:string;message:string;retryable:boolean};requestId:string};
export const LIMITS={maxOperationsPerProposal:12,maxBodyBytes:32768,proposalTtlSeconds:600,confirmationTtlSeconds:300,sessionTtlSeconds:86400} as const;
