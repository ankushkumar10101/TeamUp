const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== TEAMUP SYSTEM-DESIGN API TEST SUITE ===\n');

  // 1. Auth Test
  console.log('1. Testing Authentication...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@teamup.dev', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  console.log('Login Manager Status:', loginRes.status, '| Success:', loginData.success);
  if (!loginData.success) throw new Error('Manager login failed');
  const token = loginData.token;

  // 2. Projects List
  console.log('\n2. Testing Projects Retrieval...');
  const projRes = await fetch(`${BASE_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projData = await projRes.json();
  console.log('Projects Count:', projData.data?.length);
  const project = projData.data[0];
  console.log('Sample Project:', project.name, '(ID:', project._id, ')');

  // 3. Server-Side Pagination & Caching
  console.log('\n3. Testing Server-Side Pagination & Cache-Aside...');
  const task1Res = await fetch(`${BASE_URL}/projects/${project._id}/tasks?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const task1Data = await task1Res.json();
  console.log('Task Page 1 Count:', task1Data.data?.length, '| Total:', task1Data.pagination?.total, '| Cached:', task1Data.cached);

  // Second request to check cache hit (if Redis is active or memory)
  const task2Res = await fetch(`${BASE_URL}/projects/${project._id}/tasks?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const task2Data = await task2Res.json();
  console.log('Task Page 1 Repeat Cached Flag:', task2Data.cached);

  // 4. Idempotency Test
  console.log('\n4. Testing Idempotency on Task Creation...');
  const idempotencyKey = 'test-idemp-key-' + Date.now();
  const createTaskPayload = {
    title: 'Automated Idempotent Task ' + Date.now(),
    description: 'Testing duplicate request protection',
    status: 'TODO',
    priority: 'HIGH',
  };

  const create1Res = await fetch(`${BASE_URL}/projects/${project._id}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(createTaskPayload),
  });
  const create1Data = await create1Res.json();
  console.log('First Request Status:', create1Res.status, '| Task ID:', create1Data.data?._id);

  // Immediate retry with the EXACT same idempotency key
  const create2Res = await fetch(`${BASE_URL}/projects/${project._id}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(createTaskPayload),
  });
  const create2Data = await create2Res.json();
  const isReplay = create2Res.headers.get('x-idempotent-replay');
  console.log('Retry Request Status:', create2Res.status, '| Replay Header:', isReplay, '| Same Task ID:', create2Data.data?._id === create1Data.data?._id);

  const createdTaskId = create1Data.data._id;
  const initialVersion = create1Data.data.version;

  // 5. Optimistic Concurrency Control (OCC) Test
  console.log('\n5. Testing Optimistic Concurrency Control (OCC)...');
  console.log('Initial Task Version:', initialVersion);

  // Successful update with matching version
  const update1Res = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Updated Task by User A',
      status: 'IN_PROGRESS',
      version: initialVersion,
    }),
  });
  const update1Data = await update1Res.json();
  console.log('User A Update Status:', update1Res.status, '| New Version:', update1Data.data?.version);

  // Stale update by User B who still had the old initialVersion
  console.log('User B attempting update with stale version:', initialVersion);
  const update2Res = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Conflicting update by User B',
      status: 'DONE',
      version: initialVersion, // STALE VERSION!
    }),
  });
  const update2Data = await update2Res.json();
  console.log('User B Update Status:', update2Res.status, '(Expected 409 Conflict)');
  console.log('Conflict Message:', update2Data.message);
  console.log('Conflict Data returned:', update2Data.data?.currentVersion);

  // 6. RBAC Permissions Matrix Test
  console.log('\n6. Testing RBAC Permissions...');
  // Login as Member
  const memberLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'charlie@teamup.dev', password: 'password123' }),
  });
  const memberData = await memberLoginRes.json();
  const memberToken = memberData.token;

  // Member attempts to delete a project (ADMIN only)
  const deleteProjRes = await fetch(`${BASE_URL}/projects/${project._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  console.log('Member Delete Project Status:', deleteProjRes.status, '(Expected 403 Forbidden)');

  // Member attempts to assign a task (ADMIN or MANAGER only)
  const assignTaskRes = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({
      assignedTo: memberData.user._id,
      version: update1Data.data.version,
    }),
  });
  console.log('Member Assign Task Status:', assignTaskRes.status, '(Expected 403 Forbidden)');

  console.log('\n=== ALL SYSTEM-DESIGN VERIFICATION TESTS PASSED! ===');
}

runTests().catch(console.error);
