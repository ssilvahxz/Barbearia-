// ==================== APP STATE ====================
const App = {
  user: null,
  settings: {},
  currentPage: 'home',
  bookingStep: 1,
  selectedService: null,
  selectedDate: null,
  selectedTime: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear()
};

// ==================== API ====================
const API = {
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async get(url) {
    const res = await fetch(url);
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    return res.json();
  },
  async upload(url, formData) {
    const res = await fetch(url, { method: 'POST', body: formData });
    return res.json();
  },
  async uploadPut(url, formData) {
    const res = await fetch(url, { method: 'PUT', body: formData });
    return res.json();
  }
};

// ==================== TOAST ====================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ==================== NAVIGATION ====================
function navigate(page) {
  App.currentPage = page;
  document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
  const section = document.getElementById(`page-${page}`);
  if (section) {
    section.style.display = 'block';
    window.scrollTo(0, 0);
  }
  // Update nav active
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`.nav-link[data-page="${page}"]`).forEach(l => l.classList.add('active'));
  // Close mobile menu
  document.getElementById('mobile-menu').classList.remove('open');
  // Load page data
  loadPageData(page);
}

// ==================== AUTH ====================
function openAuthModal(mode) {
  document.getElementById('auth-modal').classList.add('open');
  document.getElementById('auth-login-form').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('auth-recover-form').style.display = 'none';
  document.getElementById('auth-modal-title').textContent = mode === 'login' ? 'Entrar' : 'Criar Conta';
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
}

function switchAuthForm(form) {
  document.getElementById('auth-login-form').style.display = form === 'login' ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = form === 'register' ? 'block' : 'none';
  document.getElementById('auth-recover-form').style.display = form === 'recover' ? 'block' : 'none';
  const titles = { login: 'Entrar', register: 'Criar Conta', recover: 'Recuperar Senha' };
  document.getElementById('auth-modal-title').textContent = titles[form];
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showToast('Preencha todos os campos', 'error');
  const result = await API.post('/api/auth/login', { email, password });
  if (result.error) return showToast(result.error, 'error');
  App.user = result.user;
  closeAuthModal();
  updateAuthUI();
  showToast(`Bem-vindo, ${result.user.name}!`);
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const phone = document.getElementById('register-phone').value.trim();
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;
  if (!name || !email || !password) return showToast('Preencha todos os campos obrigatórios', 'error');
  if (password !== confirm) return showToast('As senhas não coincidem', 'error');
  if (password.length < 6) return showToast('Senha deve ter no mínimo 6 caracteres', 'error');
  const result = await API.post('/api/auth/register', { name, email, phone, password });
  if (result.error) return showToast(result.error, 'error');
  App.user = result.user;
  closeAuthModal();
  updateAuthUI();
  showToast('Conta criada com sucesso!');
}

async function handleLogout() {
  await API.post('/api/auth/logout', {});
  App.user = null;
  updateAuthUI();
  navigate('home');
  showToast('Você saiu da sua conta');
}

function updateAuthUI() {
  const authBtns = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  if (App.user) {
    authBtns.style.display = 'none';
    userMenu.style.display = 'flex';
    document.getElementById('user-name').textContent = App.user.name;
    if (App.user.isAdmin) {
      document.getElementById('admin-link').style.display = 'flex';
    } else {
      document.getElementById('admin-link').style.display = 'none';
    }
  } else {
    authBtns.style.display = 'flex';
    userMenu.style.display = 'none';
    document.getElementById('admin-link').style.display = 'none';
  }
}

async function checkAuth() {
  try {
    const result = await API.get('/api/auth/me');
    if (result.user) { App.user = result.user; updateAuthUI(); }
  } catch (e) {}
}

// ==================== HOME PAGE ====================
async function loadHome() {
  const [servicesRes, reviewsRes, settingsRes, galleryRes] = await Promise.all([
    API.get('/api/services'),
    API.get('/api/reviews'),
    API.get('/api/settings'),
    API.get('/api/gallery')
  ]);
  
  App.settings = settingsRes.settings || {};
  
  // Update branding
  const businessName = App.settings.business_name || 'Luigue Barbeiro';
  document.getElementById('logo-text').textContent = businessName;
  document.getElementById('hero-eyebrow').textContent = businessName.toUpperCase();
  document.getElementById('hero-title').textContent = App.settings.hero_title || 'Estilo & Tradição';
  document.getElementById('hero-subtitle').textContent = App.settings.hero_subtitle || 'A melhor experiência em barbearia';
  document.getElementById('hero-desc').textContent = App.settings.business_description || '';
  document.getElementById('about-text').textContent = App.settings.business_description || '';
  document.getElementById('footer-brand-name').textContent = businessName;
  document.getElementById('footer-desc').textContent = App.settings.business_description || '';
  
  // Logo
  if (App.settings.business_logo) {
    document.getElementById('logo-img').src = App.settings.business_logo;
  }
  
  // Services
  renderHomeServices(servicesRes.services || []);
  
  // Reviews
  renderHomeReviews(reviewsRes.reviews || [], reviewsRes.stats);
  
  // Gallery
  renderGallery(galleryRes.photos || []);
  
  // Hours
  loadHours();
  
  // Contact
  if (App.settings.business_whatsapp) {
    document.getElementById('whatsapp-link').href = `https://wa.me/${App.settings.business_whatsapp}`;
    document.getElementById('whatsapp-float').href = `https://wa.me/${App.settings.business_whatsapp}`;
    document.getElementById('whatsapp-number').textContent = App.settings.business_phone || '';
  }
  if (App.settings.business_instagram) {
    document.getElementById('instagram-link').href = App.settings.business_instagram;
  }
  if (App.settings.business_address) {
    document.getElementById('address-text').textContent = App.settings.business_address;
    document.getElementById('address-section').style.display = 'block';
  }
}

function renderHomeServices(services) {
  const container = document.getElementById('home-services-grid');
  if (!services.length) { container.innerHTML = '<p class="no-data">Nenhum serviço disponível</p>'; return; }
  container.innerHTML = services.map(s => `
    <div class="service-card fade-in">
      <div class="service-icon">✂</div>
      <div class="service-name">${esc(s.name)}</div>
      ${s.description ? `<div class="service-desc">${esc(s.description)}</div>` : ''}
      <div class="service-meta">
        <div class="service-price">${s.price > 0 ? 'R$ ' + s.price.toFixed(2) : 'Consulte'}</div>
        <div class="service-duration">⏱ ${s.duration} min</div>
      </div>
      <button class="btn btn-primary btn-sm service-book-btn" onclick="startBooking(${s.id})">Agendar</button>
    </div>
  `).join('');
  observeAnimations();
}

function renderHomeReviews(reviews, stats) {
  if (!stats) stats = { total: 0, average: 0 };
  document.getElementById('reviews-total').textContent = stats.total;
  document.getElementById('reviews-avg').textContent = stats.average.toFixed(1);
  document.getElementById('reviews-stars').innerHTML = renderStars(stats.average);
  
  const container = document.getElementById('reviews-grid');
  if (!reviews.length) { container.innerHTML = '<p class="no-data">Seja o primeiro a avaliar!</p>'; return; }
  container.innerHTML = reviews.slice(0, 6).map(r => `
    <div class="review-card fade-in">
      <div class="review-stars">${renderStars(r.rating)}</div>
      <div class="review-comment">${esc(r.comment || 'Sem comentário')}</div>
      <div class="review-author">
        <div class="review-avatar">${esc(r.user_name?.charAt(0) || '?')}</div>
        <div>
          <div class="review-name">${esc(r.user_name || 'Cliente')}</div>
          <div class="review-date">${formatDate(r.created_at)}</div>
        </div>
      </div>
      ${r.admin_reply ? `<div class="review-reply"><div class="review-reply-label">Resposta da barbearia</div><div class="review-reply-text">${esc(r.admin_reply)}</div></div>` : ''}
    </div>
  `).join('');
  observeAnimations();
}

function renderGallery(photos) {
  const container = document.getElementById('gallery-grid');
  if (!photos.length) { container.innerHTML = '<p class="no-data">Nenhuma foto na galeria ainda</p>'; return; }
  container.innerHTML = photos.map(p => `
    <div class="gallery-item fade-in" onclick="openLightbox('${p.image}', '${esc(p.title || '')}', '${esc(p.description || '')}')">
      <img src="${p.image}" alt="${esc(p.title || 'Foto')}" loading="lazy">
      <div class="gallery-item-overlay">
        <div class="gallery-item-title">${esc(p.title || '')}</div>
        <div class="gallery-item-desc">${esc(p.description || '')}</div>
      </div>
    </div>
  `).join('');
  observeAnimations();
}

async function loadHours() {
  const result = await API.get('/api/hours');
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const container = document.getElementById('hours-grid');
  container.innerHTML = result.hours.map(h => `
    <div class="hours-item">
      <span class="hours-day">${dayNames[h.day_of_week]}</span>
      ${h.is_closed ? '<span class="hours-closed">FECHADO</span>' : `<span class="hours-time">${h.open_time} – ${h.close_time}</span>`}
    </div>
  `).join('');
}

function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= Math.round(rating) ? '★' : '☆';
  }
  return stars;
}

function openLightbox(src, title, desc) {
  const lb = document.getElementById('lightbox');
  lb.querySelector('img').src = src;
  lb.querySelector('.lightbox-title').textContent = title;
  lb.querySelector('.lightbox-desc').textContent = desc;
  lb.classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

// ==================== BOOKING ====================
function startBooking(serviceId) {
  if (!App.user) { openAuthModal('login'); showToast('Faça login para agendar', 'info'); return; }
  navigate('booking');
  App.bookingStep = 1;
  App.selectedService = serviceId || null;
  App.selectedDate = null;
  App.selectedTime = null;
  updateBookingUI();
  if (serviceId) selectService(serviceId);
}

async function updateBookingUI() {
  const steps = document.querySelectorAll('.step');
  steps.forEach((s, i) => {
    s.classList.remove('active', 'completed');
    if (i + 1 < App.bookingStep) s.classList.add('completed');
    if (i + 1 === App.bookingStep) s.classList.add('active');
  });
  
  document.querySelectorAll('.step-connector').forEach((c, i) => {
    c.classList.toggle('active', i + 1 < App.bookingStep);
  });
  
  document.querySelectorAll('.booking-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`booking-step-${App.bookingStep}`).classList.add('active');
  
  if (App.bookingStep === 1) await loadBookingServices();
  if (App.bookingStep === 2) renderCalendar();
  if (App.bookingStep === 3 && App.selectedDate) await loadTimeSlots();
  if (App.bookingStep === 4) renderConfirmation();
}

async function loadBookingServices() {
  const result = await API.get('/api/services');
  const container = document.getElementById('service-select-grid');
  container.innerHTML = result.services.map(s => `
    <div class="service-select-card ${App.selectedService === s.id ? 'selected' : ''}" onclick="selectService(${s.id})">
      <div class="service-name">${esc(s.name)}</div>
      ${s.description ? `<div class="service-desc">${esc(s.description)}</div>` : ''}
      <div class="service-meta" style="margin-top:8px">
        <div class="service-price">${s.price > 0 ? 'R$ ' + s.price.toFixed(2) : 'Consulte'}</div>
        <div class="service-duration">⏱ ${s.duration} min</div>
      </div>
    </div>
  `).join('');
}

function selectService(id) {
  App.selectedService = id;
  document.querySelectorAll('.service-select-card').forEach(c => {
    c.classList.toggle('selected', c.onclick.toString().includes(id));
  });
  // Simple re-render for selection highlight
  document.querySelectorAll('.service-select-card').forEach(c => c.classList.remove('selected'));
  const cards = document.querySelectorAll('.service-select-card');
  cards.forEach(c => {
    if (c.getAttribute('onclick')?.includes(id)) c.classList.add('selected');
  });
  // Better approach - reload with selection
  loadBookingServices();
}

function nextStep() {
  if (App.bookingStep === 1 && !App.selectedService) return showToast('Selecione um serviço', 'error');
  if (App.bookingStep === 2 && !App.selectedDate) return showToast('Selecione uma data', 'error');
  if (App.bookingStep === 3 && !App.selectedTime) return showToast('Selecione um horário', 'error');
  if (App.bookingStep < 4) { App.bookingStep++; updateBookingUI(); }
}

function prevStep() {
  if (App.bookingStep > 1) { App.bookingStep--; updateBookingUI(); }
}

// Calendar
function renderCalendar() {
  const container = document.getElementById('calendar-container');
  const month = App.calendarMonth;
  const year = App.calendarYear;
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  
  document.getElementById('calendar-title').textContent = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  
  let html = '<div class="calendar-days">';
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  dayNames.forEach(d => html += `<div class="calendar-day-name">${d}</div>`);
  
  // Previous month days
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day other-month"></div>';
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isSunday = new Date(year, month, day).getDay() === 0;
    const isDisabled = isPast || isSunday;
    const isSelected = App.selectedDate === date;
    
    html += `<div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
      ${isDisabled ? '' : `onclick="selectDate('${date}')"`}>${day}</div>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function prevMonth() {
  if (App.calendarMonth === 0) { App.calendarMonth = 11; App.calendarYear--; }
  else App.calendarMonth--;
  renderCalendar();
}

function nextMonth() {
  if (App.calendarMonth === 11) { App.calendarMonth = 0; App.calendarYear++; }
  else App.calendarMonth++;
  renderCalendar();
}

function selectDate(date) {
  App.selectedDate = date;
  renderCalendar();
  // Auto-load time slots
  App.bookingStep = 3;
  updateBookingUI();
}

async function loadTimeSlots() {
  if (!App.selectedDate) return;
  const result = await API.get(`/api/appointments/available-slots?date=${App.selectedDate}`);
  if (result.isClosed) {
    document.getElementById('time-slots-container').innerHTML = '<p class="no-data">Barbearia fechada neste dia</p>';
    return;
  }
  const container = document.getElementById('time-slots-container');
  container.innerHTML = '<div class="time-slots">' + result.slots.map(s => 
    `<div class="time-slot ${s.available ? '' : 'unavailable'}" 
      ${s.available ? `onclick="selectTime('${s.time}')"` : ''}>${s.time}</div>`
  ).join('') + '</div>';
}

function selectTime(time) {
  App.selectedTime = time;
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
  event.target.classList.add('selected');
  App.bookingStep = 4;
  updateBookingUI();
}

async function confirmBooking() {
  if (!App.user) { openAuthModal('login'); return; }
  const result = await API.post('/api/appointments', {
    serviceId: App.selectedService,
    date: App.selectedDate,
    time: App.selectedTime
  });
  if (result.error) return showToast(result.error, 'error');
  showToast('Agendamento confirmado com sucesso!');
  renderConfirmationResult(result.appointment);
}

async function renderConfirmation() {
  const servicesRes = await API.get('/api/services');
  const service = servicesRes.services.find(s => s.id === App.selectedService);
  const container = document.getElementById('booking-step-4');
  
  const [year, month, day] = App.selectedDate.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  const dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const dayOfWeek = new Date(App.selectedDate + 'T12:00:00').getDay();
  
  container.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-icon">✂</div>
      <div class="confirmation-title">Resumo do Agendamento</div>
      <div style="color:var(--gray);margin-bottom:20px">Confirme os dados abaixo</div>
      <div class="confirmation-details">
        <div class="confirmation-item">
          <div class="confirmation-label">Cliente</div>
          <div class="confirmation-value">${esc(App.user.name)}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Serviço</div>
          <div class="confirmation-value">${service ? esc(service.name) : ''}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Data</div>
          <div class="confirmation-value">${dateFormatted} (${dayNames[dayOfWeek]})</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Horário</div>
          <div class="confirmation-value">${App.selectedTime}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Duração</div>
          <div class="confirmation-value">${service ? service.duration + ' min' : ''}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Preço</div>
          <div class="confirmation-value">${service && service.price > 0 ? 'R$ ' + service.price.toFixed(2) : 'Consulte'}</div>
        </div>
      </div>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="prevStep()">← Voltar</button>
        <button class="btn btn-primary btn-lg" onclick="confirmBooking()">Confirmar Agendamento</button>
      </div>
    </div>
  `;
}

function renderConfirmationResult(appt) {
  const container = document.getElementById('booking-step-4');
  const [year, month, day] = appt.date.split('-');
  container.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-icon">✓</div>
      <div class="confirmation-title">Agendamento Confirmado!</div>
      <div style="color:var(--gray)">Seu horário foi reservado com sucesso</div>
      <div class="confirmation-details">
        <div class="confirmation-item">
          <div class="confirmation-label">Cliente</div>
          <div class="confirmation-value">${esc(appt.client_name)}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Serviço</div>
          <div class="confirmation-value">${esc(appt.service_name)}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Data</div>
          <div class="confirmation-value">${day}/${month}/${year}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Horário</div>
          <div class="confirmation-value">${appt.time}</div>
        </div>
        <div class="confirmation-item">
          <div class="confirmation-label">Status</div>
          <div class="confirmation-value"><span class="badge badge-pending">Pendente</span></div>
        </div>
      </div>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigate('my-appointments')">Ver Meus Agendamentos</button>
        <button class="btn btn-secondary" onclick="navigate('home')">Voltar ao Início</button>
      </div>
    </div>
  `;
}

// ==================== MY APPOINTMENTS ====================
async function loadMyAppointments() {
  if (!App.user) { openAuthModal('login'); return; }
  const result = await API.get('/api/appointments');
  const container = document.getElementById('my-appointments-list');
  
  if (!result.appointments.length) {
    container.innerHTML = '<p class="no-data">Você ainda não tem agendamentos</p>';
    return;
  }
  
  const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };
  const statusColors = { pending: 'badge-pending', confirmed: 'badge-confirmed', completed: 'badge-completed', cancelled: 'badge-cancelled' };
  
  container.innerHTML = result.appointments.map(a => {
    const [y,m,d] = a.date.split('-');
    const canCancel = (a.status === 'pending' || a.status === 'confirmed');
    const canReview = a.status === 'completed';
    return `
    <div class="appointment-card">
      <div class="appointment-info">
        <div class="appointment-service">${esc(a.service_name)}</div>
        <div class="appointment-date">${d}/${m}/${y} às ${a.time} · R$ ${a.price > 0 ? a.price.toFixed(2) : '–'}</div>
        <span class="badge ${statusColors[a.status]}">${statusLabels[a.status]}</span>
      </div>
      <div class="appointment-actions">
        ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${a.id})">Cancelar</button>` : ''}
        ${canReview ? `<button class="btn btn-primary btn-sm" onclick="openReviewModal(${a.id})">Avaliar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function cancelAppointment(id) {
  if (!confirm('Deseja realmente cancelar este agendamento? Cancelamento permitido com 2h de antecedência.')) return;
  const result = await API.put(`/api/appointments/${id}/status`, { status: 'cancelled' });
  if (result.error) return showToast(result.error, 'error');
  showToast('Agendamento cancelado');
  loadMyAppointments();
}

// ==================== REVIEWS ====================
function openReviewModal(appointmentId) {
  document.getElementById('review-modal').classList.add('open');
  document.getElementById('review-appointment-id').value = appointmentId;
  document.getElementById('review-rating-value').value = 0;
  document.querySelectorAll('#review-star-selector .star').forEach(s => s.classList.remove('active'));
  document.getElementById('review-comment').value = '';
}

function setReviewRating(val) {
  document.getElementById('review-rating-value').value = val;
  document.querySelectorAll('#review-star-selector .star').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

async function submitReview() {
  const appointmentId = parseInt(document.getElementById('review-appointment-id').value);
  const rating = parseInt(document.getElementById('review-rating-value').value);
  const comment = document.getElementById('review-comment').value.trim();
  if (!rating || rating < 1) return showToast('Selecione uma nota', 'error');
  
  const result = await API.post('/api/reviews', { appointmentId, rating, comment });
  if (result.error) return showToast(result.error, 'error');
  document.getElementById('review-modal').classList.remove('open');
  showToast('Avaliação enviada com sucesso!');
  loadMyAppointments();
}

// ==================== PROFILE ====================
async function loadProfile() {
  if (!App.user) { openAuthModal('login'); return; }
  const result = await API.get('/api/auth/me');
  if (result.user) {
    document.getElementById('profile-name').value = result.user.name;
    document.getElementById('profile-email').value = result.user.email;
    document.getElementById('profile-phone').value = result.user.phone || '';
  }
}

async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const result = await API.put('/api/auth/profile', { name, phone });
  if (result.error) return showToast(result.error, 'error');
  App.user.name = name;
  updateAuthUI();
  showToast('Perfil atualizado!');
}

async function changePassword() {
  const current = document.getElementById('current-password').value;
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-new-password').value;
  if (!current || !newPass) return showToast('Preencha todos os campos', 'error');
  if (newPass !== confirm) return showToast('As senhas não coincidem', 'error');
  if (newPass.length < 6) return showToast('Senha deve ter no mínimo 6 caracteres', 'error');
  const result = await API.put('/api/auth/password', { currentPassword: current, newPassword: newPass });
  if (result.error) return showToast(result.error, 'error');
  showToast('Senha alterada com sucesso!');
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-new-password').value = '';
}

// ==================== ADMIN ====================
function navigateAdmin(panel) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`admin-${panel}`).classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll(`.sidebar-item[data-panel="${panel}"]`).forEach(i => i.classList.add('active'));
  // Close mobile sidebar
  document.querySelector('.admin-sidebar')?.classList.remove('open');
  loadAdminPanel(panel);
}

async function loadAdminPanel(panel) {
  switch(panel) {
    case 'dashboard': await loadDashboard(); break;
    case 'appointments': await loadAdminAppointments(); break;
    case 'services': await loadAdminServices(); break;
    case 'clients': await loadAdminClients(); break;
    case 'reviews': await loadAdminReviews(); break;
    case 'gallery': await loadAdminGallery(); break;
    case 'hours': await loadAdminHours(); break;
    case 'settings': await loadAdminSettings(); break;
  }
}

async function loadDashboard() {
  const result = await API.get('/api/admin/dashboard');
  document.getElementById('dash-today-count').textContent = result.todayAppointments.length;
  document.getElementById('dash-upcoming').textContent = result.upcomingCount;
  document.getElementById('dash-clients').textContent = result.totalClients;
  document.getElementById('dash-rating').textContent = result.avgRating.toFixed(1);
  document.getElementById('dash-revenue').textContent = `R$ ${result.revenue.toFixed(2)}`;
  document.getElementById('dash-month-revenue').textContent = `R$ ${result.monthRevenue.toFixed(2)}`;
  
  // Top services
  document.getElementById('dash-top-services').innerHTML = result.topServices.map(s =>
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(200,164,92,0.05)">
      <span>${esc(s.name)}</span><span style="color:var(--gold)">${s.count} agendamentos</span>
    </div>`
  ).join('') || '<p class="no-data">Sem dados</p>';
  
  // Today's appointments
  document.getElementById('dash-today-list').innerHTML = result.todayAppointments.map(a =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(200,164,92,0.05)">
      <div><strong>${a.time}</strong> · ${esc(a.client_name)} · ${esc(a.service_name)}</div>
      <span class="badge badge-${a.status}">${statusLabel(a.status)}</span>
    </div>`
  ).join('') || '<p class="no-data">Nenhum agendamento hoje</p>';
}

function statusLabel(s) {
  return { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' }[s] || s;
}

async function loadAdminAppointments() {
  const result = await API.get('/api/appointments');
  renderAdminAppointmentsTable(result.appointments || []);
}

function renderAdminAppointmentsTable(appointments) {
  const tbody = document.getElementById('admin-appointments-tbody');
  if (!appointments.length) { tbody.innerHTML = '<tr><td colspan="7" class="no-data">Nenhum agendamento</td></tr>'; return; }
  tbody.innerHTML = appointments.map(a => {
    const [y,m,d] = a.date.split('-');
    return `<tr>
      <td>${d}/${m}/${y}</td>
      <td>${a.time}</td>
      <td>${esc(a.client_name)}</td>
      <td>${esc(a.service_name)}</td>
      <td><span class="badge badge-${a.status}">${statusLabel(a.status)}</span></td>
      <td>R$ ${a.price > 0 ? a.price.toFixed(2) : '–'}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${a.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="updateApptStatus(${a.id},'confirmed')">Confirmar</button>` : ''}
          ${a.status !== 'completed' && a.status !== 'cancelled' ? `<button class="btn btn-danger btn-sm" onclick="updateApptStatus(${a.id},'cancelled')">Cancelar</button>` : ''}
          ${a.status === 'confirmed' ? `<button class="btn btn-primary btn-sm" onclick="updateApptStatus(${a.id},'completed')">Concluir</button>` : ''}
          ${a.status !== 'cancelled' ? `<button class="btn btn-secondary btn-sm" onclick="rescheduleAppt(${a.id},'${a.date}','${a.time}')">Reagendar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function updateApptStatus(id, status) {
  const result = await API.put(`/api/appointments/${id}/status`, { status });
  if (result.error) return showToast(result.error, 'error');
  showToast('Status atualizado!');
  loadAdminAppointments();
}

function rescheduleAppt(id, currentDate, currentTime) {
  const newDate = prompt('Nova data (AAAA-MM-DD):', currentDate);
  if (!newDate) return;
  const newTime = prompt('Novo horário (HH:MM):', currentTime);
  if (!newTime) return;
  API.put(`/api/appointments/${id}/reschedule`, { date: newDate, time: newTime }).then(r => {
    if (r.error) return showToast(r.error, 'error');
    showToast('Agendamento reagendado!');
    loadAdminAppointments();
  });
}

async function filterAppointments() {
  const date = document.getElementById('filter-date').value;
  const serviceId = document.getElementById('filter-service').value;
  const search = document.getElementById('filter-search').value;
  let url = '/api/appointments?';
  if (date) url += `date=${date}&`;
  if (serviceId) url += `service_id=${serviceId}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  const result = await API.get(url);
  renderAdminAppointmentsTable(result.appointments || []);
}

// Admin Services
async function loadAdminServices() {
  const result = await API.get('/api/services/all');
  const tbody = document.getElementById('admin-services-tbody');
  if (!result.services.length) { tbody.innerHTML = '<tr><td colspan="6" class="no-data">Nenhum serviço</td></tr>'; return; }
  tbody.innerHTML = result.services.map(s =>
    `<tr>
      <td>${esc(s.name)}</td>
      <td>${s.price > 0 ? 'R$ ' + s.price.toFixed(2) : '–'}</td>
      <td>${s.duration} min</td>
      <td><div class="toggle ${s.is_active ? 'active' : ''}" onclick="toggleService(${s.id}, ${s.is_active})"></div></td>
      <td>${s.image ? `<img src="${s.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px">` : '–'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editService(${s.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})">Excluir</button>
      </td>
    </tr>`
  ).join('');
}

async function openAddService() {
  document.getElementById('service-form-modal').classList.add('open');
  document.getElementById('service-form-title').textContent = 'Adicionar Serviço';
  document.getElementById('service-id').value = '';
  document.getElementById('svc-name').value = '';
  document.getElementById('svc-desc').value = '';
  document.getElementById('svc-duration').value = '30';
  document.getElementById('svc-price').value = '0';
  document.getElementById('svc-image-preview').style.display = 'none';
  document.getElementById('svc-active').value = '1';
}

async function editService(id) {
  const result = await API.get('/api/services/all');
  const service = result.services.find(s => s.id === id);
  if (!service) return;
  document.getElementById('service-form-modal').classList.add('open');
  document.getElementById('service-form-title').textContent = 'Editar Serviço';
  document.getElementById('service-id').value = id;
  document.getElementById('svc-name').value = service.name;
  document.getElementById('svc-desc').value = service.description || '';
  document.getElementById('svc-duration').value = service.duration;
  document.getElementById('svc-price').value = service.price;
  document.getElementById('svc-active').value = service.is_active ? '1' : '0';
  if (service.image) {
    document.getElementById('svc-image-preview').src = service.image;
    document.getElementById('svc-image-preview').style.display = 'block';
  }
}

async function saveService() {
  const id = document.getElementById('service-id').value;
  const form = document.getElementById('service-form');
  const formData = new FormData(form);
  
  let url = '/api/services';
  let method = API.upload;
  if (id) { url = `/api/services/${id}`; method = API.uploadPut; }
  
  const result = await method(url, formData);
  if (result.error) return showToast(result.error, 'error');
  document.getElementById('service-form-modal').classList.remove('open');
  showToast(id ? 'Serviço atualizado!' : 'Serviço adicionado!');
  loadAdminServices();
}

async function deleteService(id) {
  if (!confirm('Deseja excluir este serviço?')) return;
  const result = await API.delete(`/api/services/${id}`);
  if (result.error) return showToast(result.error, 'error');
  showToast('Serviço excluído');
  loadAdminServices();
}

async function toggleService(id, currentActive) {
  const formData = new FormData();
  formData.append('name', ''); // Will be filled server-side
  const result = await API.put(`/api/services/${id}`, { is_active: currentActive ? '0' : '1', name: 'keep', description: 'keep', duration: '30', price: '0' });
  showToast('Serviço atualizado');
  loadAdminServices();
}

// Admin Clients
async function loadAdminClients() {
  const result = await API.get('/api/admin/clients');
  renderAdminClients(result.clients || []);
}

function renderAdminClients(clients) {
  const tbody = document.getElementById('admin-clients-tbody');
  if (!clients.length) { tbody.innerHTML = '<tr><td colspan="5" class="no-data">Nenhum cliente</td></tr>'; return; }
  tbody.innerHTML = clients.map(c =>
    `<tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.email)}</td>
      <td>${esc(c.phone || '–')}</td>
      <td><span class="badge ${c.is_blocked ? 'badge-cancelled' : 'badge-completed'}">${c.is_blocked ? 'Bloqueado' : 'Ativo'}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewClientHistory(${c.id})">Histórico</button>
        ${c.is_blocked
          ? `<button class="btn btn-success btn-sm" onclick="unblockClient(${c.id})">Desbloquear</button>`
          : `<button class="btn btn-danger btn-sm" onclick="blockClient(${c.id})">Bloquear</button>`
        }
      </td>
    </tr>`
  ).join('');
}

async function searchClients() {
  const search = document.getElementById('client-search').value;
  const result = await API.get(`/api/admin/clients?search=${encodeURIComponent(search)}`);
  renderAdminClients(result.clients || []);
}

async function blockClient(id) {
  if (!confirm('Bloquear este cliente?')) return;
  await API.put(`/api/admin/clients/${id}/block`);
  showToast('Cliente bloqueado');
  loadAdminClients();
}

async function unblockClient(id) {
  await API.put(`/api/admin/clients/${id}/unblock`);
  showToast('Cliente desbloqueado');
  loadAdminClients();
}

async function viewClientHistory(id) {
  const result = await API.get(`/api/admin/clients/${id}/history`);
  const modal = document.getElementById('client-history-modal');
  modal.classList.add('open');
  const list = document.getElementById('client-history-list');
  if (!result.appointments.length) { list.innerHTML = '<p class="no-data">Sem histórico</p>'; return; }
  list.innerHTML = result.appointments.map(a => {
    const [y,m,d] = a.date.split('-');
    return `<div style="padding:10px 0;border-bottom:1px solid rgba(200,164,92,0.05)">
      <strong>${d}/${m}/${y}</strong> às ${a.time} · ${esc(a.service_name)} · R$ ${a.price > 0 ? a.price.toFixed(2) : '–'} · <span class="badge badge-${a.status}">${statusLabel(a.status)}</span>
    </div>`;
  }).join('');
}

// Admin Reviews
async function loadAdminReviews() {
  const result = await API.get('/api/reviews/all');
  const tbody = document.getElementById('admin-reviews-tbody');
  if (!result.reviews.length) { tbody.innerHTML = '<tr><td colspan="6" class="no-data">Nenhuma avaliação</td></tr>'; return; }
  tbody.innerHTML = result.reviews.map(r =>
    `<tr>
      <td>${esc(r.user_name)}</td>
      <td>${renderStars(r.rating)}</td>
      <td>${esc(r.comment || '–')}</td>
      <td><div class="toggle ${r.is_visible ? 'active' : ''}" onclick="toggleReviewVisibility(${r.id},${r.is_visible})"></div></td>
      <td>${esc(r.admin_reply || '–')}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="replyReview(${r.id})">Responder</button>
        <button class="btn btn-danger btn-sm" onclick="deleteReview(${r.id})">Excluir</button>
      </td>
    </tr>`
  ).join('');
}

async function toggleReviewVisibility(id, visible) {
  await API.put(`/api/reviews/${id}`, { is_visible: visible ? 0 : 1 });
  showToast('Visibilidade atualizada');
  loadAdminReviews();
}

async function replyReview(id) {
  const reply = prompt('Sua resposta:');
  if (!reply) return;
  await API.put(`/api/reviews/${id}`, { admin_reply: reply, is_visible: 1 });
  showToast('Resposta enviada!');
  loadAdminReviews();
}

async function deleteReview(id) {
  if (!confirm('Excluir esta avaliação?')) return;
  await API.delete(`/api/reviews/${id}`);
  showToast('Avaliação excluída');
  loadAdminReviews();
}

// Admin Gallery
async function loadAdminGallery() {
  const result = await API.get('/api/gallery');
  const container = document.getElementById('admin-gallery-list');
  if (!result.photos.length) { container.innerHTML = '<p class="no-data">Nenhuma foto na galeria</p>'; return; }
  container.innerHTML = result.photos.map(p =>
    `<div style="display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid rgba(200,164,92,0.05)">
      <img src="${p.image}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">
      <div style="flex:1">
        <div style="font-weight:600">${esc(p.title || 'Sem título')}</div>
        <div style="color:var(--gray);font-size:0.85rem">${esc(p.description || '')}</div>
        ${p.is_featured ? '<span class="badge badge-confirmed">Destaque</span>' : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="editGalleryPhoto(${p.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteGalleryPhoto(${p.id})">Excluir</button>
      </div>
    </div>`
  ).join('');
}

function openAddPhoto() {
  document.getElementById('gallery-form-modal').classList.add('open');
  document.getElementById('gallery-form-title').textContent = 'Adicionar Foto';
  document.getElementById('gallery-id').value = '';
  document.getElementById('gallery-title').value = '';
  document.getElementById('gallery-desc').value = '';
  document.getElementById('gallery-featured').value = '0';
  document.getElementById('gallery-image-preview').style.display = 'none';
}

function editGalleryPhoto(id) {
  // Load data from current list
  document.getElementById('gallery-form-modal').classList.add('open');
  document.getElementById('gallery-form-title').textContent = 'Editar Foto';
  document.getElementById('gallery-id').value = id;
}

function handleGalleryDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    const input = document.getElementById('gallery-image');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    previewGalleryImage(file);
  }
}

function previewGalleryImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('gallery-image-preview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function saveGalleryPhoto() {
  const form = document.getElementById('gallery-form');
  const formData = new FormData(form);
  const id = document.getElementById('gallery-id').value;
  
  let url = '/api/gallery';
  let method = API.upload;
  if (id) { url = `/api/gallery/${id}`; method = API.uploadPut; }
  
  const result = await method(url, formData);
  if (result.error) return showToast(result.error, 'error');
  document.getElementById('gallery-form-modal').classList.remove('open');
  showToast(id ? 'Foto atualizada!' : 'Foto adicionada!');
  loadAdminGallery();
  loadHome();
}

async function deleteGalleryPhoto(id) {
  if (!confirm('Excluir esta foto?')) return;
  await API.delete(`/api/gallery/${id}`);
  showToast('Foto excluída');
  loadAdminGallery();
}

// Admin Hours
async function loadAdminHours() {
  const result = await API.get('/api/hours');
  const container = document.getElementById('admin-hours-form');
  const dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  container.innerHTML = result.hours.map(h => `
    <div style="display:grid;grid-template-columns:120px 1fr 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(200,164,92,0.05)">
      <strong>${dayNames[h.day_of_week]}</strong>
      <div class="form-group" style="margin:0">
        <input type="time" class="form-input" id="hours-open-${h.day_of_week}" value="${h.open_time || '09:00'}" ${h.is_closed ? 'disabled' : ''}>
      </div>
      <div class="form-group" style="margin:0">
        <input type="time" class="form-input" id="hours-close-${h.day_of_week}" value="${h.close_time || '19:30'}" ${h.is_closed ? 'disabled' : ''}>
      </div>
      <div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="hours-closed-${h.day_of_week}" ${h.is_closed ? 'checked' : ''} onchange="toggleHoursDay(${h.day_of_week})"> Fechado
        </label>
      </div>
    </div>
  `).join('') + '<button class="btn btn-primary" style="margin-top:20px" onclick="saveAllHours()">Salvar Horários</button>';
}

function toggleHoursDay(day) {
  const closed = document.getElementById(`hours-closed-${day}`).checked;
  document.getElementById(`hours-open-${day}`).disabled = closed;
  document.getElementById(`hours-close-${day}`).disabled = closed;
}

async function saveAllHours() {
  for (let day = 0; day <= 6; day++) {
    const open = document.getElementById(`hours-open-${day}`)?.value;
    const close = document.getElementById(`hours-close-${day}`)?.value;
    const isClosed = document.getElementById(`hours-closed-${day}`)?.checked;
    await API.put(`/api/hours/${day}`, { open_time: open, close_time: close, is_closed: isClosed });
  }
  showToast('Horários atualizados!');
  loadHours();
}

// Admin Settings
async function loadAdminSettings() {
  const result = await API.get('/api/settings');
  App.settings = result.settings || {};
  const s = App.settings;
  document.getElementById('set-name').value = s.business_name || '';
  document.getElementById('set-desc').value = s.business_description || '';
  document.getElementById('set-phone').value = s.business_phone || '';
  document.getElementById('set-whatsapp').value = s.business_whatsapp || '';
  document.getElementById('set-instagram').value = s.business_instagram || '';
  document.getElementById('set-address').value = s.business_address || '';
  document.getElementById('set-hero-title').value = s.hero_title || '';
  document.getElementById('set-hero-subtitle').value = s.hero_subtitle || '';
}

async function saveSettings() {
  const data = {
    business_name: document.getElementById('set-name').value.trim(),
    business_description: document.getElementById('set-desc').value.trim(),
    business_phone: document.getElementById('set-phone').value.trim(),
    business_whatsapp: document.getElementById('set-whatsapp').value.trim(),
    business_instagram: document.getElementById('set-instagram').value.trim(),
    business_address: document.getElementById('set-address').value.trim(),
    hero_title: document.getElementById('set-hero-title').value.trim(),
    hero_subtitle: document.getElementById('set-hero-subtitle').value.trim()
  };
  const result = await API.put('/api/settings', data);
  if (result.error) return showToast(result.error, 'error');
  showToast('Configurações salvas!');
  loadHome();
}

async function uploadLogo() {
  const input = document.getElementById('set-logo');
  if (!input.files[0]) return;
  const formData = new FormData();
  formData.append('logo', input.files[0]);
  const result = await API.upload('/api/settings/logo', formData);
  if (result.error) return showToast(result.error, 'error');
  showToast('Logo atualizada!');
  loadHome();
  loadAdminSettings();
}

// ==================== HELPERS ====================
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function observeAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
}

function loadPageData(page) {
  switch(page) {
    case 'home': loadHome(); break;
    case 'booking': updateBookingUI(); break;
    case 'my-appointments': loadMyAppointments(); break;
    case 'profile': loadProfile(); break;
    case 'admin': if (App.user?.isAdmin) navigateAdmin('dashboard'); break;
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  navigate('home');
  
  // Hide loading
  const loader = document.getElementById('loading-overlay');
  if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 500); }
  
  // Scroll effect on header
  window.addEventListener('scroll', () => {
    document.querySelector('.header').classList.toggle('scrolled', window.scrollY > 50);
  });
  
  // File input preview handlers
  document.getElementById('svc-image')?.addEventListener('change', function() {
    if (this.files[0]) {
      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById('svc-image-preview').src = e.target.result;
        document.getElementById('svc-image-preview').style.display = 'block';
      };
      reader.readAsDataURL(this.files[0]);
    }
  });
  
  document.getElementById('gallery-image')?.addEventListener('change', function() {
    if (this.files[0]) previewGalleryImage(this.files[0]);
  });
  
  // Set logo input
  document.getElementById('set-logo')?.addEventListener('change', function() {
    if (this.files[0]) uploadLogo();
  });
});
