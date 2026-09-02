import {describe,expect,it} from 'vitest';import {mayApply} from '../packages/policy/src/index';
const state={sessionId:'s',version:4,widthIn:108,lengthIn:132,budgetCents:1400000,items:[]};
const base={id:'p',baseVersion:4,hash:'h',status:'approved' as const,operations:[],createdAt:'2026-09-02T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'};
describe('proposal gate',()=>{it('permits fresh approved proposal',()=>expect(mayApply(base,state).allowed).toBe(true));it('rejects stale version',()=>expect(mayApply({...base,baseVersion:3},state)).toEqual({allowed:false,code:'VERSION_CONFLICT'}));});
