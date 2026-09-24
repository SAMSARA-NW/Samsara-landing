const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/involvement');
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.statusCode=c;return this},json(b){this.body=b;return this}}}
let n=0;
function request(body={}){return {method:'POST',headers:{'content-type':'application/json',origin:'https://samsara-landing-psi.vercel.app','x-forwarded-for':String(++n)},body:{email:'visitor@example.com',description:'I would like to help with the olive trees.',website:'',requestId:'12345678-1234-1234-1234-123456789abc',...body}}}
test('involvement handler validation, delivery and failure paths',async()=>{
process.env.RESEND_API_KEY='test-only';let calls=[];global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true}};
let r=response();await handler(request(),r);assert.equal(r.statusCode,200);let sent=JSON.parse(calls[0].options.body);assert.deepEqual(sent.to,['nicolas.criticos98@gmail.com']);assert.equal(sent.reply_to,'visitor@example.com');assert.match(sent.text,/help with the olive trees/);
const key=calls[0].options.headers['Idempotency-Key'];r=response();await handler(request(),r);assert.equal(calls[1].options.headers['Idempotency-Key'],key);
for(const body of [{email:'bad'},{email:'a@b.com\r\nBcc: thief@example.com'},{description:'short'},{description:'x'.repeat(2001)},{requestId:null}]){r=response();await handler(request(body),r);assert.equal(r.statusCode,400)}
let before=calls.length;r=response();await handler(request({website:'spam.example'}),r);assert.equal(r.statusCode,200);assert.equal(calls.length,before);
r=response();let req=request();req.headers.origin='https://untrusted.example';await handler(req,r);assert.equal(r.statusCode,403);
r=response();req=request();req.method='GET';await handler(req,r);assert.equal(r.statusCode,405);
r=response();req=request();delete req.headers['content-type'];await handler(req,r);assert.equal(r.statusCode,415);
global.fetch=async()=>({ok:false});r=response();await handler(request(),r);assert.equal(r.statusCode,502);
global.fetch=async()=>{throw Error('network')};r=response();await handler(request(),r);assert.equal(r.statusCode,502);
delete process.env.RESEND_API_KEY;r=response();await handler(request(),r);assert.equal(r.statusCode,503);
process.env.RESEND_API_KEY='test-only';global.fetch=async()=>({ok:true});req=request();for(let i=0;i<6;i++){r=response();await handler(req,r)}assert.equal(r.statusCode,429);
});
