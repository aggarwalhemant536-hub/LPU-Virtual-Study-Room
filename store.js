/* StudyNest data layer: localStorage acts as the "database". */
const DB = (() => {
  const K = 'sn_v1';
  const room = (id, title, cat, desc, owner, priv, cap, mem) => ({
    id, title, cat, desc, owner, priv, cap, flag: 0,
    members: mem.map(u => ({ u, s: 'in' })),
    msgs: [{ u: owner, t: 'Welcome to ' + title + '! Say hi and share what you are studying today.', ts: Date.now() - 36e5 }],
    tasks: [{ t: 'Introduce yourself', d: 0 }, { t: 'Set a goal for this session', d: 0 }],
    rate: { u2: 5, u3: 4 }
  });
  const seed = () => ({
    users: [
      { id: 'u1', name: 'Admin LPU', email: 'admin@lpu.demo', pass: 'Admin@123', role: 'admin', bio: 'Platform administrator', goal: 120, on: 1 },
      { id: 'u2', name: 'Aarav Singh', email: 'learner@lpu.demo', pass: 'Learner@123', role: 'learner', bio: 'CSE, Semester 3', goal: 90, on: 1 },
      { id: 'u3', name: 'Meera Kapoor', email: 'meera@lpu.demo', pass: 'Meera@123', role: 'learner', bio: 'ECE, Semester 3', goal: 90, on: 1 },
      { id: 'u4', name: 'Rohan Das', email: 'rohan@lpu.demo', pass: 'Rohan@123', role: 'learner', bio: 'Maths, Semester 1', goal: 60, on: 1 }
    ],
    cats: ['Programming', 'Mathematics', 'Electronics', 'Exam Prep', 'Languages', 'Design'],
    rooms: [
      room('r1', 'DSA Daily Grind', 'Programming', 'Solve three problems together every evening.', 'u2', 0, 10, ['u2', 'u3', 'u4']),
      room('r2', 'Calculus Crunch', 'Mathematics', 'Limits, integrals and doubt clearing.', 'u3', 0, 8, ['u3', 'u4']),
      room('r3', 'ECE120 Circuits Lab Prep', 'Electronics', 'Arduino, sensors and breadboard revision.', 'u3', 0, 6, ['u3', 'u2']),
      room('r4', 'Placement Mock Interviews', 'Exam Prep', 'Invite-only mock interviews. Request to join.', 'u2', 1, 4, ['u2']),
      room('r5', 'Spoken English Circle', 'Languages', 'Practice speaking for 30 minutes daily.', 'u1', 0, 12, ['u1', 'u4']),
      room('r6', 'UI Design Sprint', 'Design', 'Critique each other\'s layouts and Figma files.', 'u4', 0, 3, ['u4', 'u3', 'u2'])
    ],
    log: [...Array(10)].flatMap((_, i) => [
      { u: 'u2', m: 25 + ((i * 37) % 55), ts: Date.now() - i * 864e5, room: 'r1' },
      { u: 'u3', m: 30 + ((i * 23) % 50), ts: Date.now() - i * 864e5 * (i % 3 ? 1 : 2), room: 'r2' }
    ]),
    acts: [{ u: 'u2', t: 'Created room DSA Daily Grind', ts: Date.now() - 864e5 }],
    notes: [], session: null
  });
  let d;
  const load = () => { try { d = JSON.parse(localStorage.getItem(K)); } catch (e) { d = null; } if (!d || !d.users) { d = seed(); save(); } };
  const save = () => localStorage.setItem(K, JSON.stringify(d));
  load();
  return {
    get d() { return d; },
    save,
    reload: load,
    reset() { d = seed(); save(); },
    id: () => Math.random().toString(36).slice(2, 9)
  };
})();
