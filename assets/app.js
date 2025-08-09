(function () {
  'use strict';

  // -------- Helpers --------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const todayStr = () => new Date().toISOString().slice(0, 10);

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.hidden = true), 2400);
  }

  // -------- Sample Data --------
  const defaultSessions = [
    { id: 's1', name: 'حلقة تحفيظ - جزء عم', teacher: 'الشيخ أحمد', day: 'الأحد', time: '7:00 م', capacity: 20 },
    { id: 's2', name: 'تجويد متقدم', teacher: 'الشيخة مريم', day: 'الثلاثاء', time: '6:30 م', capacity: 15 },
    { id: 's3', name: 'إتقان الحفظ', teacher: 'الشيخ عبدالله', day: 'الخميس', time: '8:00 م', capacity: 10 },
    { id: 's4', name: 'قراءة الإجازة', teacher: 'الشيخ سامي', day: 'الأربعاء', time: '5:30 م', capacity: 8 },
    { id: 's5', name: 'التأسيس للصغار', teacher: 'الأستاذة خلود', day: 'السبت', time: '4:30 م', capacity: 25 },
    { id: 's6', name: 'التلاوة الصحيحة', teacher: 'الشيخ مازن', day: 'الاثنين', time: '7:45 م', capacity: 18 },
  ];

  // Initialize data in localStorage if missing
  const sessions = storage.get('sessions', defaultSessions);
  storage.set('sessions', sessions);

  // Note: do not keep a stale in-memory copy; always read registrations from storage when needed
  storage.set('registrations', storage.get('registrations', []));

  const attendance = storage.get('attendance', {}); // { 'YYYY-MM-DD': { [sessionId]: { [regId]: true } } }
  storage.set('attendance', attendance);

  // -------- UI: Header/Footer --------
  $('#year').textContent = new Date().getFullYear();

  // -------- Sessions List --------
  function renderSessionsList() {
    const list = $('#sessionsList');
    const q = ($('#searchInput').value || '').trim();
    const day = $('#dayFilter').value || '';

    const filtered = sessions.filter((s) => {
      const matchQuery = !q || (s.name + ' ' + s.teacher).includes(q);
      const matchDay = !day || s.day === day;
      return matchQuery && matchDay;
    });

    list.innerHTML = '';
    if (!filtered.length) {
      list.innerHTML = '<div class="card">لا توجد حلقات مطابقة للبحث.</div>';
      return;
    }

    for (const s of filtered) {
      const used = storage.get('registrations', []).filter((r) => r.sessionId === s.id).length;
      const left = Math.max(0, s.capacity - used);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${s.name}</h3>
        <div class="meta">المعلم: ${s.teacher}</div>
        <div class="meta">اليوم: ${s.day} — الوقت: ${s.time}</div>
        <div class="meta">المقاعد المتبقية: ${left}</div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <a class="btn btn-primary" href="#register" data-goto-register="${s.id}">التسجيل في الحلقة</a>
        </div>
      `;
      list.appendChild(card);
    }
  }

  $('#searchInput').addEventListener('input', renderSessionsList);
  $('#dayFilter').addEventListener('change', renderSessionsList);

  // Delegate click for quick-jump to register with selected session
  $('#sessions').addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto-register]');
    if (!link) return;
    const sid = link.getAttribute('data-goto-register');
    const select = $('#sessionId');
    if (select) {
      select.value = sid;
      select.dispatchEvent(new Event('change'));
    }
  });

  // -------- Registration Form --------
  function fillSessionsSelect() {
    const select = $('#sessionId');
    select.innerHTML = '<option value="">— اختر —</option>' + sessions
      .map((s) => `<option value="${s.id}">${s.name} — ${s.day} ${s.time}</option>`) 
      .join('');
  }

  function validateForm(data) {
    const errors = {};
    if (!data.fullName || data.fullName.trim().length < 3) {
      errors.fullName = 'الاسم مطلوب وبحد أدنى 3 أحرف';
    }
    if (!/^0\d{9}$/.test(data.phone || '')) {
      errors.phone = 'الرقم يجب أن يكون بصيغة 05xxxxxxxx';
    }
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.email = 'صيغة البريد غير صحيحة';
    }
    if (!data.age || +data.age < 5) {
      errors.age = 'العمر الأدنى 5 سنوات';
    }
    if (!data.sessionId) {
      errors.sessionId = 'يرجى اختيار الحلقة';
    }
    return errors;
  }

  function showErrors(errors) {
    $$('.error').forEach((el) => (el.textContent = ''));
    Object.entries(errors).forEach(([key, message]) => {
      const el = document.querySelector(`[data-error-for="${key}"]`);
      if (el) el.textContent = message;
    });
  }

  $('#registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const errors = validateForm(data);
    if (Object.keys(errors).length) {
      showErrors(errors);
      showToast('تحقق من الحقول');
      return;
    }

    // Capacity check
    const selected = sessions.find((s) => s.id === data.sessionId);
    const used = storage.get('registrations', []).filter((r) => r.sessionId === selected.id).length;
    if (used >= selected.capacity) {
      $('#formMessage').textContent = '';
      showToast('عذراً، اكتمل عدد المقاعد لهذه الحلقة');
      return;
    }

    const list = storage.get('registrations', []);
    const reg = {
      id: 'r' + Math.random().toString(36).slice(2, 9),
      createdAt: new Date().toISOString(),
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      email: (data.email || '').trim(),
      age: +data.age,
      sessionId: data.sessionId,
    };
    list.push(reg);
    storage.set('registrations', list);

    e.currentTarget.reset();
    $('#formMessage').textContent = 'تم التسجيل بنجاح!';
    showToast('تم التسجيل بنجاح');
    renderSessionsList();
    if (!$('#adminPanel').hidden) {
      renderAdmin();
    }
  });

  // -------- Admin --------
  const ADMIN_CODE = 'admin123';

  $('#adminLoginBtn').addEventListener('click', () => {
    const code = $('#adminCode').value;
    if (code === ADMIN_CODE) {
      $('#adminGate').hidden = true;
      $('#adminPanel').hidden = false;
      $('#attendanceDate').value = todayStr();
      renderAdmin();
      showToast('تم الدخول كمسؤول');
    } else {
      showToast('رمز غير صحيح');
    }
  });

  function computeAttendanceStats() {
    const regs = storage.get('registrations', []);
    const att = storage.get('attendance', {});
    const dates = Object.keys(att);
    if (!dates.length || !regs.length) return 0;

    let presentCount = 0;
    let possible = 0;
    for (const date of dates) {
      for (const s of sessions) {
        const map = att[date]?.[s.id] || {};
        const regsInS = regs.filter((r) => r.sessionId === s.id);
        possible += regsInS.length;
        presentCount += regsInS.filter((r) => map[r.id]).length;
      }
    }
    return possible ? Math.round((presentCount / possible) * 100) : 0;
  }

  function renderAdmin() {
    // Stats
    $('#statSessions').textContent = sessions.length;
    $('#statRegistrations').textContent = storage.get('registrations', []).length;
    $('#statAttendance').textContent = computeAttendanceStats() + '%';

    // Tabs behavior
    $$('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.tab-panel').forEach((p) => (p.hidden = true));
        $('#' + btn.dataset.tab).hidden = false;
      });
    });

    renderRegistrationsPanel();
    renderAttendancePanel();
  }

  function renderRegistrationsPanel() {
    const regs = storage.get('registrations', []);
    const container = $('#registrationsContainer');
    container.innerHTML = '';

    if (!regs.length) {
      container.innerHTML = '<div class="card">لا يوجد مسجلون حتى الآن.</div>';
      return;
    }

    // Group by session
    for (const s of sessions) {
      const regsInS = regs.filter((r) => r.sessionId === s.id);
      if (!regsInS.length) continue;

      const box = document.createElement('div');
      box.className = 'card';
      const listItems = regsInS
        .map((r) => {
          const attended = countAttendanceForRegistrant(r.id);
          return `
            <div class="attendee-row">
              <div>
                <div class="attendee-name">${r.fullName}</div>
                <div class="meta">${r.phone}${r.email ? ' · ' + r.email : ''}</div>
              </div>
              <div class="muted">حضور: ${attended}</div>
              <div class="attendee-actions">
                <button class="btn btn-ghost" data-print-cert="${r.id}">طباعة شهادة</button>
                <button class="btn btn-danger" data-remove-reg="${r.id}">حذف</button>
              </div>
            </div>
          `;
        })
        .join('');

      box.innerHTML = `
        <h3>${s.name} — ${s.day} ${s.time}</h3>
        <div class="meta">المعلم: ${s.teacher} · السعة: ${s.capacity}</div>
        <div class="attendance-list" style="margin-top:10px;">${listItems}</div>
      `;
      container.appendChild(box);
    }

    container.addEventListener('click', (e) => {
      const btnRemove = e.target.closest('[data-remove-reg]');
      const btnCert = e.target.closest('[data-print-cert]');
      if (btnRemove) {
        const id = btnRemove.getAttribute('data-remove-reg');
        const list = storage.get('registrations', []);
        const next = list.filter((x) => x.id !== id);
        storage.set('registrations', next);
        showToast('تم حذف المسجل');
        renderSessionsList();
        renderRegistrationsPanel();
        renderAttendancePanel();
      }
      if (btnCert) {
        const id = btnCert.getAttribute('data-print-cert');
        printCertificate(id);
      }
    }, { once: true });
  }

  function renderAttendancePanel() {
    const date = $('#attendanceDate').value || todayStr();
    const regs = storage.get('registrations', []);
    const att = storage.get('attendance', {});
    const container = $('#attendanceContainer');
    container.innerHTML = '';

    if (!regs.length) {
      container.innerHTML = '<div class="card">لا يوجد مسجلون لعرض الحضور.</div>';
      return;
    }

    for (const s of sessions) {
      const regsInS = regs.filter((r) => r.sessionId === s.id);
      if (!regsInS.length) continue;

      const box = document.createElement('div');
      box.className = 'card';

      const listItems = regsInS
        .map((r) => {
          const present = !!(att[date]?.[s.id]?.[r.id]);
          return `
            <div class="attendee-row">
              <div class="attendee-name">${r.fullName}</div>
              <div class="muted">${present ? 'حاضر' : 'غائب'}</div>
              <div class="attendee-actions">
                <button class="btn ${present ? 'btn-ghost' : 'btn-primary'}" data-toggle-present="${r.id}" data-session="${s.id}" data-date="${date}">
                  ${present ? 'إلغاء' : 'حاضر'}
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      box.innerHTML = `
        <h3>${s.name} — ${s.day} ${s.time}</h3>
        <div class="attendance-list" style="margin-top:10px;">${listItems}</div>
      `;
      container.appendChild(box);
    }

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-toggle-present]');
      if (!btn) return;
      const regId = btn.getAttribute('data-toggle-present');
      const sId = btn.getAttribute('data-session');
      const dateStr = btn.getAttribute('data-date');

      const att = storage.get('attendance', {});
      att[dateStr] = att[dateStr] || {};
      att[dateStr][sId] = att[dateStr][sId] || {};
      att[dateStr][sId][regId] = !att[dateStr][sId][regId];
      storage.set('attendance', att);
      renderAttendancePanel();
      $('#statAttendance').textContent = computeAttendanceStats() + '%';
    }, { once: true });
  }

  $('#attendanceDate').addEventListener('change', renderAttendancePanel);

  function countAttendanceForRegistrant(regId) {
    const att = storage.get('attendance', {});
    let count = 0;
    for (const date of Object.keys(att)) {
      for (const sId of Object.keys(att[date])) {
        if (att[date][sId][regId]) count += 1;
      }
    }
    return count;
  }

  function printCertificate(regId) {
    const regs = storage.get('registrations', []);
    const r = regs.find((x) => x.id === regId);
    if (!r) return;
    const s = sessions.find((x) => x.id === r.sessionId);
    const attended = countAttendanceForRegistrant(r.id);
    const date = new Date().toLocaleDateString('ar');

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>شهادة حضور</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  body { margin: 0; background: #f7fafc; font-family: 'Cairo', sans-serif; }
  .cert { width: 900px; margin: 40px auto; padding: 40px; background: #fff; border: 6px double #1b3a4b; border-radius: 20px; }
  .head { text-align: center; margin-bottom: 20px; }
  .head h1 { margin: 0; font-size: 34px; color: #1b3a4b; }
  .meta { text-align: center; color: #6b7280; margin-bottom: 24px; }
  .name { text-align: center; font-size: 28px; font-weight: 800; margin: 6px 0 16px; }
  .text { text-align: center; font-size: 18px; }
  .row { display: flex; justify-content: space-between; margin-top: 34px; color: #374151; }
  .badge { display: inline-block; background: #27c3a8; color: #042b24; padding: 6px 12px; border-radius: 999px; font-weight: 700; }
  .print { margin-top: 24px; text-align: center; }
  .print button { padding: 10px 18px; background: #1b3a4b; color: #fff; border: none; border-radius: 10px; cursor: pointer; }
  @media print { .print { display: none; } }
</style>
</head>
<body>
  <div class="cert">
    <div class="head">
      <h1>شهادة حضور</h1>
      <div class="meta">مقارئ الأوقاف الإلكترونية</div>
    </div>
    <div class="text">تمنح هذه الشهادة للطالب</div>
    <div class="name">${r.fullName}</div>
    <div class="text">لمواظبته على حضور حلقة <strong>${s.name}</strong> بإشراف <strong>${s.teacher}</strong>.</div>
    <div class="row">
      <div>عدد مرات الحضور: <span class="badge">${attended}</span></div>
      <div>التاريخ: ${date}</div>
    </div>
    <div class="print">
      <button onclick="window.print()">طباعة</button>
    </div>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  // -------- Init --------
  fillSessionsSelect();
  renderSessionsList();
})();