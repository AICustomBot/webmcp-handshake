export interface Env {ASSETS:Fetcher;DESIGN_SESSION:DurableObjectNamespace<DesignSession>}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
 return Response.json({ok:false,error:{code:'NOT_IMPLEMENTED',message:'Architecture scaffold only.',retryable:false}},{status:501});
}} satisfies ExportedHandler<Env>;
export class DesignSession extends DurableObject<Env>{async fetch():Promise<Response>{return Response.json({ok:false,error:{code:'NOT_IMPLEMENTED',message:'Implement from frozen contracts.',retryable:false}},{status:501});}}
