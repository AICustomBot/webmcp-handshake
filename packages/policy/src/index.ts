import type {Proposal,RoomState} from '@handshake/contracts';
export type ApplyDecision={allowed:true}|{allowed:false;code:string};
export function mayApply(proposal:Proposal,state:RoomState,now=new Date()):ApplyDecision{
 if(proposal.status!=='approved') return {allowed:false,code:'PROPOSAL_NOT_APPROVED'};
 if(new Date(proposal.expiresAt)<=now) return {allowed:false,code:'PROPOSAL_EXPIRED'};
 if(proposal.baseVersion!==state.version) return {allowed:false,code:'VERSION_CONFLICT'};
 return {allowed:true};
}
