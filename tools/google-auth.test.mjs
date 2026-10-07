import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseAuthService,oauthRedirectUrl} from '../js/services/supabase-auth.mjs';
test('Google認証はSupabaseを経由し指定したアプリへ戻る',async()=>{
 const redirect=oauthRedirectUrl('http://127.0.0.1:4177/app.html?role=admin#profile');
 assert.equal(redirect,'http://127.0.0.1:4177/app.html?auth=google');
 let request;
 const service=createSupabaseAuthService({client:{auth:{getSession(){},async signInWithOAuth(args){request=args;return {data:{}};}}},oauthRedirect:redirect});
 await service.signInWithGoogle();
 assert.deepEqual(request,{provider:'google',options:{redirectTo:redirect}});
});
test('Google認証開始エラーを呼び出し元へ返す',async()=>{
 const service=createSupabaseAuthService({client:{auth:{getSession(){},async signInWithOAuth(){return {error:new Error('provider disabled')};}}},oauthRedirect:'http://127.0.0.1:4177/app.html?auth=google'});
 await assert.rejects(service.signInWithGoogle(),error=>error.code==='google-sign-in-failed');
});
