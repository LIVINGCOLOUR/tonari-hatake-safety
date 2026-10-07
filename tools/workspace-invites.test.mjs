import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseAuthService } from '../js/services/supabase-auth.mjs';

test('招待発行は既存の管理者認可RPCを呼び、本人指定と一回限りの制限を渡す', async () => {
  let request;
  const service = createSupabaseAuthService({ client: { auth: { getSession() {} },
    async rpc(name, args) { request = { name, args }; return { data: [{ invite_token: 'test-token' }] }; },
  } });
  await service.createInvite('region-a', 'neighbor', 'PERSON@example.invalid');
  assert.deepEqual(request, { name: 'create_workspace_invite', args: {
    p_workspace_id: 'region-a', p_role: 'neighbor', p_email: 'person@example.invalid', p_max_uses: 1,
  } });
  await assert.rejects(service.createInvite('region-a', 'neighbor', 'invalid'), error => error.code === 'invalid-email');
});

test('招待の認可失敗を成功扱いしない', async () => {
  const service = createSupabaseAuthService({ client: { auth: { getSession() {} },
    async rpc() { return { error: { code: '42501' } }; },
  } });
  await assert.rejects(service.createInvite('region-a', 'neighbor', ''), error => error.code === 'create-invite-failed');
});

test('地域管理を一般の自己選択や招待で追加できない', async () => {
  const service = createSupabaseAuthService({ client: {
    auth: { getSession: async () => ({data:{session:{user:{id:'person'}}}}) },
    rpc() { assert.fail('不正な立場ではRPCを呼ばない'); },
  } });
  await assert.rejects(service.createInvite('region-a', 'admin', ''), e => e.code === 'invalid-role');
  await assert.rejects(service.addWorkspaceRole('region-a', 'admin'), e => e.code === 'invalid-role');
  await assert.rejects(service.setMyWorkspaceRoles('region-a', ['sprayer','admin']), e => e.code === 'invalid-role');
});

test('初回の立場と兼務の保存は専用RPCへ渡す', async () => {
  const requests = [];
  const service = createSupabaseAuthService({client:{auth:{getSession(){}},
    async rpc(name,args) { requests.push({name,args}); return {data:'region-a'}; },
  }});
  await service.createWorkspace({name:'地域',role:'neighbor'});
  await service.setMyWorkspaceRoles('region-a',['sprayer','neighbor']);
  assert.equal(requests[0].name,'create_workspace_for_user');
  assert.equal(requests[0].args.p_role,'neighbor');
  assert.deepEqual(requests[1],{name:'set_my_workspace_roles',args:{p_workspace_id:'region-a',p_roles:['sprayer','neighbor']}});
});
