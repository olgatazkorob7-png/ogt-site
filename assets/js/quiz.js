/** Lead form: progressive enhancement, no storage of personal data in the browser. */
export function isValidContact(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 254 || /[<>;"']/.test(text)) return false;
  if (!/\s/.test(text)) {
    if (/^[^\s@<>;"']+@[^\s@<>;"']+\.[^\s@<>;"']{2,}$/.test(text)
      || /^@[a-z0-9_]{3,32}$/i.test(text)
      || /^(?:https?:\/\/)?t\.me\/[a-z0-9_]{3,32}\/?$/i.test(text)) {
      return true;
    }
  }
  const phoneCompact = text.replace(/[\s().-]/g, '');
  return /^\+?\d{10,15}$/.test(phoneCompact);
}
export function hasExcessiveLinks(value, maxLinks = 3) {
  const matches = String(value ?? '').match(/https?:\/\/|www\./gi);
  return (matches ? matches.length : 0) > maxLinks;
}
export class LeadSubmissionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LeadSubmissionError';
    this.code = code;
  }
}
/** Only an explicit JSON acknowledgement is treated as success, never a 200 HTML page. */
export async function sendLead(action, data, { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: data,
      signal: controller.signal,
    });
    if (!response.ok) throw new LeadSubmissionError(response.status === 429 ? 'rate-limit' : 'rejected');
    const result = await response.json().catch(() => null);
    // Formspree's SDK recognizes { next: string }; some responses also expose { ok: true }.
    // Render our own confirmation rather than following a URL from the response.
    const acknowledged = result && typeof result === 'object' && !Array.isArray(result)
      && result.ok !== false && !result.error && !result.errors
      && (result.ok === true || (typeof result.next === 'string' && result.next.trim().length > 0));
    if (!acknowledged) throw new LeadSubmissionError('unconfirmed');
  } catch (error) {
    if (error instanceof LeadSubmissionError) throw error;
    throw new LeadSubmissionError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timeout);
  }
}
export function initQuiz(root = document) {
  const form = root.getElementById('project-quiz');
  if (!form || typeof globalThis.fetch !== 'function' || typeof AbortController !== 'function') return;
  const quiz = form.closest('.lead-quiz') || form;
  const steps = [...form.querySelectorAll('[data-quiz-step]')];
  const next = root.getElementById('quiz-next');
  const back = root.getElementById('quiz-back');
  const submit = root.getElementById('quiz-submit');
  const submitLabel = root.getElementById('quiz-submit-label');
  const errorBox = root.getElementById('quiz-submit-error');
  const success = root.getElementById('quiz-success');
  const progress = form.querySelector('[role="progressbar"]');
  const progressText = root.getElementById('quiz-step-text');
  const progressFill = root.getElementById('quiz-progress-fill');
  const summary = root.getElementById('quiz-summary');
  const prefillBanner = root.getElementById('quiz-prefill-banner');
  const titles = ['формат', 'задача', 'контакт'];
  const contact = form.elements.namedItem('contact');
  const message = form.elements.namedItem('message');
  const privacy = form.elements.namedItem('privacy');
  const gotcha = form.elements.namedItem('_gotcha');
  const loadedAt = Date.now();
  let current = 0;
  let submitting = false;
  let completed = false;
  let started = false;
  let lastAutoNote = '';
  let lastAutoChannel = '';
  function goal(name) {
    try { globalThis.trackGoal?.(name); } catch { /* Analytics must never block a lead. */ }
  }
  function markStarted() {
    if (!started) { started = true; goal('quiz_start'); }
  }
  function focusQuizStep() {
    const target = completed ? success : steps[current].querySelector('legend');
    target.focus({ preventScroll: true });
    if (typeof quiz.getBoundingClientRect === 'function' && typeof quiz.scrollIntoView === 'function') {
      const rect = quiz.getBoundingClientRect();
      const vh = globalThis.innerHeight || 800;
      if (rect.top < 96 || rect.top > vh * 0.65) {
        const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        quiz.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      }
    }
  }
  function showStep(index, focus = true) {
    current = index;
    steps.forEach((step, i) => { step.hidden = i !== current; });
    back.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
    progressText.textContent = `Шаг ${current + 1} из ${steps.length}`;
    progress.setAttribute('aria-valuenow', String(current + 1));
    progress.setAttribute('aria-valuetext', `${progressText.textContent}: ${titles[current]}`);
    progressFill.style.width = `${((current + 1) / steps.length) * 100}%`;
    if (current === 2) {
      const data = new FormData(form);
      const checkedChannel = form.querySelector('[name="channel"]:checked');
      const channelLabel = checkedChannel?.closest?.('.quiz-option')?.querySelector('strong')?.textContent
        || data.get('channel')
        || 'не выбран';
      summary.textContent = `Формат: ${channelLabel}. Задача: ${data.get('task') || 'не выбрана'}.`;
      summary.hidden = false;
    }
    if (prefillBanner && current !== 0) {
      prefillBanner.hidden = true;
      prefillBanner.textContent = '';
    }
    if (focus) focusQuizStep();
  }
  function showFieldError(name, text) {
    const node = root.getElementById(`quiz-${name}-error`);
    node.textContent = text;
    node.hidden = !text;
    form.querySelectorAll(`[name="${name}"]`).forEach(input => {
      if (text) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
  }
  function validateStep(index) {
    let firstInvalid = null;
    const fail = (name, text) => {
      showFieldError(name, text);
      firstInvalid ||= form.querySelector(`[name="${name}"]`);
    };
    if (index < 2) {
      const name = index === 0 ? 'channel' : 'task';
      if (!form.querySelector(`[name="${name}"]:checked`)) fail(name, 'Выберите один из вариантов. Если сомневаетесь, подойдёт последний.');
      else showFieldError(name, '');
    } else {
      if (!isValidContact(contact.value)) fail('contact', 'Укажите email, @username, ссылку t.me/username или номер телефона.');
      else showFieldError('contact', '');
      if (message.value.length > 1500) fail('message', 'Сократите описание до 1500 символов.');
      else if (hasExcessiveLinks(message.value)) fail('message', 'Укажите описание задачи своими словами без массовых ссылок.');
      else showFieldError('message', '');
      if (!privacy.checked) fail('privacy', 'Для отправки нужно согласие на обработку данных заявки.');
      else showFieldError('privacy', '');
    }
    if (firstInvalid) {
      if (current !== index) showStep(index);
      firstInvalid.focus();
      return false;
    }
    return true;
  }
  function advance() {
    if (submitting || completed || current >= 2) return;
    markStarted();
    if (validateStep(current)) {
      showStep(current + 1);
      goal(`quiz_step_${current + 1}`);
    }
  }
  function setBusy(value) {
    submitting = value;
    quiz.setAttribute('aria-busy', String(value));
    steps.forEach(step => { step.disabled = value; });
    [back, next, submit].forEach(button => { button.disabled = value; });
    submitLabel.textContent = value ? 'Отправляем…' : 'Отправить на оценку';
  }
  function selectRadio(name, value) {
    if (!value) return null;
    const match = [...form.querySelectorAll(`input[name="${name}"]`)].find(input => input.value === value);
    if (!match) return null;
    match.checked = true;
    showFieldError(name, '');
    return match;
  }
  function applyPrefill({ channel = '', task = '', note = '' }) {
    if (submitting) return;
    if (completed) {
      completed = false;
      form.hidden = false;
      success.hidden = true;
    }
    if (quiz.dataset && quiz.dataset.reveal && quiz.dataset.reveal !== 'done') {
      quiz.dataset.reveal = 'done';
    }
    if (!channel && lastAutoChannel) {
      const prevAuto = [...form.querySelectorAll('input[name="channel"]')].find(input => input.checked && input.value === lastAutoChannel);
      if (prevAuto) prevAuto.checked = false;
      lastAutoChannel = '';
    }
    const channelMatch = selectRadio('channel', channel);
    if (channelMatch) lastAutoChannel = channel;
    const taskMatch = selectRadio('task', task);
    if (message && (message.value.trim() === '' || message.value === lastAutoNote)) {
      message.value = note;
      lastAutoNote = note;
      showFieldError('message', '');
    }
    if (channelMatch && taskMatch) {
      if (prefillBanner) prefillBanner.hidden = true;
      showStep(2, false);
      steps[2]?.querySelector('legend')?.focus({ preventScroll: true });
    } else if (taskMatch) {
      const taskLabel = taskMatch.closest?.('.quiz-option')?.querySelector('strong')?.textContent || task;
      if (prefillBanner) {
        prefillBanner.textContent = `Выбрана задача: «${taskLabel}». Укажите площадку ниже и нажмите «Далее».`;
        prefillBanner.hidden = false;
      }
      showStep(0, false);
      steps[0]?.querySelector('legend')?.focus({ preventScroll: true });
    } else if (channelMatch) {
      if (prefillBanner) prefillBanner.hidden = true;
      showStep(1, false);
      steps[1]?.querySelector('legend')?.focus({ preventScroll: true });
    }
  }
  root.querySelectorAll('[data-quiz-task], [data-quiz-channel]').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault();
      applyPrefill({
        channel: trigger.dataset.quizChannel || '',
        task: trigger.dataset.quizTask || '',
        note: trigger.dataset.quizNote || '',
      });
      const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      quiz.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    });
  });
  next.addEventListener('click', advance);
  back.addEventListener('click', () => {
    if (!submitting && current > 0) { errorBox.hidden = true; showStep(current - 1); }
  });
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing && current < 2 && event.target.matches('input[type="radio"]')) {
      event.preventDefault();
      advance();
    }
  });
  form.addEventListener('input', event => {
    const name = event.target.name;
    if (['channel', 'task', 'contact', 'message', 'privacy'].includes(name)) showFieldError(name, '');
    if (name === 'message' && event.target.value !== lastAutoNote) lastAutoNote = '';
  });
  form.addEventListener('change', event => {
    if (event.target.matches('input[type="radio"]')) {
      markStarted();
      if (event.target.name === 'channel') lastAutoChannel = '';
      if (event.target.name === 'task' && prefillBanner) prefillBanner.hidden = true;
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || completed) return;
    if (gotcha && String(gotcha.value || '').trim() !== '') return;
    if (current < 2) { advance(); return; }
    if (Date.now() - loadedAt < 1500) {
      errorBox.textContent = 'Пожалуйста, подождите пару секунд и нажмите «Отправить на оценку» снова.';
      errorBox.hidden = false;
      errorBox.focus();
      return;
    }
    for (let index = 0; index < steps.length; index++) {
      if (!validateStep(index)) return;
    }
    contact.value = contact.value.trim();
    const data = new FormData(form); // Capture before disabling fields; all step answers are retained.
    errorBox.hidden = true;
    setBusy(true);
    goal('form_attempt');
    try {
      await sendLead(form.action, data);
      completed = true;
      form.hidden = true;
      success.hidden = false;
      focusQuizStep();
      goal('form_success');
      goal('form_submit'); // Existing goal is now recorded only after confirmed acceptance.
    } catch (error) {
      const messages = {
        'rate-limit': 'Сервис просит подождать перед повторной отправкой. Данные остались в форме. Можно написать напрямую в Telegram.',
        rejected: 'Сервис вернул ошибку, подтверждения приёма нет. Данные остались в форме. Попробуйте позже или напишите напрямую в Telegram.',
        unconfirmed: 'Не удалось подтвердить приём заявки. Данные остались в форме. Напишите в Telegram или повторите отправку; повтор может создать дубликат.',
        timeout: 'Подтверждение не пришло вовремя. Данные остались в форме. Перед повтором учтите: предыдущая заявка могла уже дойти.',
        network: 'Не удалось подтвердить отправку. Проверьте соединение или напишите в Telegram. Данные остались в форме; повтор может создать дубликат.',
      };
      errorBox.textContent = messages[error.code] || messages.network;
      errorBox.hidden = false;
      errorBox.focus();
    } finally {
      setBusy(false);
    }
  });
  form.noValidate = true;
  quiz.dataset.enhanced = 'true';
  form.querySelector('.quiz-progress').hidden = false;
  showStep(0, false);
}
if (typeof document !== 'undefined') initQuiz(document);
