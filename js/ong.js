// ===== DATOS DINÁMICOS (por ahora fijos, después vienen de una API/backend) =====
const datosSidebar = {
  organizacion: "Cruz Roja Argentina",
  email: "testong@gmail.com",
  logo: "", // ruta de la imagen de la ONG; si queda vacío se muestra la inicial
  verificada: true,
  vacantesPendientes: 2,
  solicitudesPendientes: 3
};

const titulosPagina = {
  resumen: "Resumen",
  perfil: "Mi perfil",
  vacantes: "Vacantes",
  solicitudes: "Solicitudes",
  voluntarios: "Voluntarios",
  donaciones: "Donaciones",
  configuracion: "Configuración"
};

const notificaciones = [
  { texto: "Nueva solicitud de Lucía Fernández", tiempo: "hace 2h" },
  { texto: "Nueva solicitud de Carlos Díaz", tiempo: "hace 5h" },
  { texto: "Recordatorio: revisar vacante Coordinador de emergencias", tiempo: "hace 1 día" }
];

// ===== DATOS DEL RESUMEN =====
const datosResumen = {
  stats: [
    { icono: "voluntarios", color: "verde",    numero: 3,   label: "Voluntarios activos",    detalle: "+2 este mes",    detalleColor: "verde" },
    { icono: "solicitudes", color: "amarillo", numero: 3,   label: "Solicitudes pendientes", detalle: "5 en total",     detalleColor: "azul" },
    { icono: "documento",   color: "gris",     numero: 2,   label: "Vacantes activas",         detalle: "3 totales",      detalleColor: "" },
    { icono: "reloj",       color: "violeta",  numero: 263, label: "Horas donadas",          detalle: "este trimestre", detalleColor: "" }
  ],
  vacantesActivas: [
    { titulo: "Coordinador de emergencias", detalle: "10h/semana · Presencial", solicitudes: 3 },
    { titulo: "Asistente social",           detalle: "8h/semana · Presencial",  solicitudes: 2 }
  ]
};

// ===== DATOS DEL PERFIL =====
const datosPerfil = {
  nombre: "Cruz Roja Argentina",
  categoria: "Emergencias",
  categorias: ["Emergencias", "Salud", "Educación", "Medio ambiente", "Acción social", "Animales"],
  ciudad: "Palermo, CABA",
  telefono: "+54 11 4304-9800",
  sitioWeb: "www.cruzroja.org.ar",
  mision: "Auxiliar, sin discriminación, a las personas vulnerables, especialmente en situaciones de emergencia, con el fin de promover el desarrollo humano y la paz en el mundo.",
  email: "testong@gmail.com",
  banner: "../../images/voluntarios.jpg"
};

// ===== DATOS DE VACANTES =====
const datosVacantes = [
  { id: 1, titulo: "Coordinador de emergencias", horas: 10, modalidad: "Presencial", descripcion: "Coordina al equipo de voluntarios durante operativos de emergencia.", solicitudes: 3, estado: "activa" },
  { id: 2, titulo: "Asistente social",           horas: 8,  modalidad: "Presencial", descripcion: "Acompaña a familias en la gestión de ayuda y trámites.", solicitudes: 2, estado: "activa" },
  { id: 3, titulo: "Conductor de ambulancia",    horas: 12, modalidad: "Presencial", descripcion: "Conduce la ambulancia en traslados programados y de emergencia.", solicitudes: 1, estado: "inactiva" }
];

// ===== DATOS DE SOLICITUDES =====
const datosSolicitudes = [
  { id: 1, nombre: "Lucía Fernández", puesto: "Coordinador de emergencias", email: "lucia@gmail.com",  disponibilidad: "Fines de semana",          fecha: "2026-08-09", estado: "pendiente", foto: "" },
  { id: 2, nombre: "Carlos Díaz",     puesto: "Asistente social",           email: "carlos@gmail.com", disponibilidad: "Días laborables — tardes",  fecha: "2026-08-10", estado: "pendiente", foto: "" },
  { id: 3, nombre: "Ana Torres",      puesto: "Conductor de ambulancia",    email: "ana@gmail.com",    disponibilidad: "Disponibilidad completa",  fecha: "2026-08-08", estado: "aceptada",  foto: "" },
  { id: 4, nombre: "Miguel Ruiz",     puesto: "Coordinador de emergencias", email: "miguel@gmail.com", disponibilidad: "Remoto / flexible",        fecha: "2026-08-07", estado: "rechazada", foto: "" },
  { id: 5, nombre: "Sara Gómez",      puesto: "Asistente social",           email: "sara@gmail.com",   disponibilidad: "Días laborables — mañanas", fecha: "2026-08-11", estado: "pendiente", foto: "" }
];

// El número rojo del menú sale de los datos reales de solicitudes
datosSidebar.solicitudesPendientes = datosSolicitudes.filter(s => s.estado === 'pendiente').length;

// ===== DATOS DE VOLUNTARIOS =====
const datosVoluntarios = [
  { id: 1, nombre: "Ana Torres",    rol: "Conductora",      email: "ana@gmail.com",    desde: "Ene 2026", horas: 48,  foto: "" },
  { id: 2, nombre: "Pedro Martín",  rol: "Asistente social", email: "pedro@gmail.com",  desde: "Mar 2025", horas: 120, foto: "" },
  { id: 3, nombre: "Isabel López",  rol: "Coordinadora",    email: "isabel@gmail.com", desde: "Jun 2025", horas: 95,  foto: "" }
];

// ===== DATOS DE DONACIONES (en pesos argentinos) =====
const datosDonaciones = {
  publicas: true,
  recaudado: 23450,
  objetivo: 50000,
  metodos: [
    { id: "cbu",   etiqueta: "CBU — Transferencia bancaria",        valor: "0209999900000000000001",    icono: "tarjeta", mono: true },
    { id: "alias", etiqueta: "Mercado Pago — Alias de cuenta",      valor: "voluntarios.cruzroja",      logo: "alias",    letra: "" },
    { id: "link",  etiqueta: "Mercado Pago Link — Enlace de pago",  valor: "mpago.la/cruzrojaargentina", logo: "link",     letra: "P" }
  ]
};

// ===== DATOS DE CONFIGURACIÓN =====
const datosConfiguracion = {
  notificaciones: [
    { id: "nuevaSolicitud",         titulo: "Nueva solicitud",           descripcion: "Te avisamos por email cuando un voluntario se postula a una vacante", activa: true },
    { id: "solicitudesSinResponder", titulo: "Solicitudes sin responder", descripcion: "Un recordatorio si tienes solicitudes pendientes de revisar",         activa: true }
  ],
  visibilidad: [
    { id: "mapa", titulo: "Mostrar mi organización en el mapa", descripcion: "Si lo apagas, los voluntarios no podrán encontrarte en el mapa", activa: true }
  ]
};

// ===== ÍCONOS SVG =====
const iconos = {
  resumen: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14"/></svg>`,
  perfil: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  vacantes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  solicitudes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  voluntarios: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  donaciones: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  configuracion: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  documento: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`,
  reloj: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  editar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  guardar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
  correo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>`,
  web: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  telefono: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  papelera: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  calendario: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  aceptar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
  rechazar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  flecha: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`,
  tendencia: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>`,
  tarjeta: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  copiar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  cerrar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  ubicacion: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
};

// ===== SIDEBAR =====
function cargarSidebar() {
  const paginaActual = document.body.dataset.page;
  const esActiva = (pagina) => paginaActual === pagina ? "active" : "";

  const sidebarHTML = `
    <aside class="sidebar">
      <button type="button" class="sidebar-cerrar-mobile" onclick="toggleSidebarONG()" aria-label="Cerrar menú">${iconos.cerrar}</button>
      <div class="sidebar-logo">
        <img src="../../images/logo.png" alt="VoluntariApp" class="logo-img">
      </div>

      <div class="sidebar-org">
        <div class="org-avatar">${datosSidebar.logo
          ? `<img src="${datosSidebar.logo}" alt="${datosSidebar.organizacion}">`
          : datosSidebar.organizacion.charAt(0)}</div>
        <div class="org-info">
          <strong>${datosSidebar.organizacion}</strong>
          <small>${datosSidebar.email}</small>
        </div>
      </div>
      ${datosSidebar.verificada ? '<span class="badge-verificada">● ONG Verificada</span>' : ''}

      <nav class="sidebar-nav">
        <a href="resumenong.html" class="${esActiva('resumen')}">${iconos.resumen}<span>Resumen</span></a>
        <a href="perfilong.html" class="${esActiva('perfil')}">${iconos.perfil}<span>Mi perfil</span></a>
        <a href="vacantesong.html" class="${esActiva('vacantes')}">${iconos.vacantes}<span>Vacantes</span>
          ${datosSidebar.vacantesPendientes > 0 ? `<span class="badge-nav">${datosSidebar.vacantesPendientes}</span>` : ''}
        </a>
        <a href="solicitudesong.html" class="${esActiva('solicitudes')}">${iconos.solicitudes}<span>Solicitudes</span>
          ${datosSidebar.solicitudesPendientes > 0 ? `<span class="badge-nav">${datosSidebar.solicitudesPendientes}</span>` : ''}
        </a>
        <a href="voluntariosong.html" class="${esActiva('voluntarios')}">${iconos.voluntarios}<span>Voluntarios</span></a>
        <a href="donacionesong.html" class="${esActiva('donaciones')}">${iconos.donaciones}<span>Donaciones</span></a>
      </nav>

      <div class="sidebar-bottom">
        <a href="configuracionong.html" class="${esActiva('configuracion')}">${iconos.configuracion}<span>Configuración</span></a>
        <a href="#" onclick="cerrarSesion()">${iconos.logout}<span>Cerrar sesión</span></a>
      </div>
    </aside>
  `;

  document.getElementById('sidebar-container').innerHTML = sidebarHTML;
}

// ===== HEADER =====
function cargarHeader() {
  const paginaActual = document.body.dataset.page;
  const tituloTexto = titulosPagina[paginaActual] || "Panel";

  const headerHTML = `
    <header class="topbar">
      <div class="topbar-izq">
        <button type="button" class="btn-menu-sidebar" onclick="toggleSidebarONG()" aria-label="Abrir menú">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="topbar-titulo">
          <h1>${tituloTexto}</h1>
          <small>Panel · ${datosSidebar.organizacion}</small>
        </div>
      </div>

      <div class="topbar-acciones">
        <div class="notif-wrapper">
          <button class="icon-btn" onclick="toggleDropdown('notif-dropdown')">
            🔔${notificaciones.length > 0 ? `<span class="dot-alerta"></span>` : ''}
          </button>
          <div id="notif-dropdown" class="dropdown hidden">
            <strong class="dropdown-titulo">Notificaciones</strong>
            ${notificaciones.map(n => `
              <div class="dropdown-item">
                <p>${n.texto}</p>
                <small>${n.tiempo}</small>
              </div>
            `).join('')}
            <a href="solicitudesong.html" class="dropdown-footer">Ver todas</a>
          </div>
        </div>

        <div class="avatar-wrapper">
          <button class="avatar-btn" onclick="toggleDropdown('avatar-dropdown')">
            ${datosSidebar.organizacion.charAt(0)}
          </button>
          <div id="avatar-dropdown" class="dropdown hidden">
            <a href="perfilong.html">Ver perfil</a>
            <a href="configuracionong.html">Configuración</a>
            <a href="#" onclick="cerrarSesion()">Cerrar sesión</a>
          </div>
        </div>
      </div>
    </header>
  `;

  document.getElementById('header-container').innerHTML = headerHTML;
}

// ===== SIDEBAR MOBILE =====
function toggleSidebarONG() {
  const sidebar = document.querySelector('.sidebar');
  let backdrop = document.getElementById('sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.onclick = toggleSidebarONG;
    document.body.appendChild(backdrop);
  }
  if (sidebar) {
    const abierto = sidebar.classList.toggle('abierto');
    backdrop.classList.toggle('visible', abierto);
  }
}
window.toggleSidebarONG = toggleSidebarONG;

// ===== DROPDOWNS =====
function toggleDropdown(id) {
  const dropdown = document.getElementById(id);
  const estabaAbierto = !dropdown.classList.contains('hidden');
  document.querySelectorAll('.dropdown').forEach(d => d.classList.add('hidden'));
  if (!estabaAbierto) dropdown.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.notif-wrapper') && !e.target.closest('.avatar-wrapper')) {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.add('hidden'));
  }
});

// ===== CERRAR SESIÓN =====
function cerrarSesion() {
  // después: avisar al backend y borrar el token (localStorage) antes de redirigir
  window.location.href = '../login.html';
}

// ===== UTILIDADES =====
// Convierte texto escrito por una persona en texto seguro para meter dentro de un innerHTML
function escaparHTML(texto) {
  return String(texto).replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caracter]));
}

// ===== VENTANA EMERGENTE (reutilizable) =====
function abrirModal(titulo, cuerpoHTML) {
  cerrarModal();

  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.id = 'modal-fondo';
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <div class="modal-cabecera">
        <h3 id="modal-titulo">${titulo}</h3>
        <button type="button" class="btn-icono btn-icono--suave" onclick="cerrarModal()" aria-label="Cerrar">${iconos.cerrar}</button>
      </div>
      <div class="modal-cuerpo">${cuerpoHTML}</div>
    </div>
  `;

  // Cerrar al hacer clic en el fondo oscuro (no dentro de la ventana)
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo) cerrarModal();
  });

  document.body.appendChild(fondo);
  document.body.classList.add('modal-abierto');
}

function cerrarModal() {
  const fondo = document.getElementById('modal-fondo');
  if (fondo) fondo.remove();
  document.body.classList.remove('modal-abierto');
}

// Cerrar con la tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});

// ===== RESUMEN =====
function iniciales(nombre) {
  return nombre.split(' ').map(palabra => palabra.charAt(0)).slice(0, 2).join('').toUpperCase();
}

function cargarResumen() {
  // Nombre de la organización
  document.getElementById('resumen-nombre').textContent = datosSidebar.organizacion;

  // Tarjetas de estadísticas
  document.getElementById('stats-grid').innerHTML = datosResumen.stats.map(s => `
    <article class="stat-card">
      <div class="stat-icono stat-icono--${s.color}">${iconos[s.icono]}</div>
      <strong class="stat-numero">${s.numero}</strong>
      <span class="stat-label">${s.label}</span>
      <small class="stat-detalle ${s.detalleColor ? 'stat-detalle--' + s.detalleColor : ''}">${s.detalle}</small>
    </article>
  `).join('');

  // Últimas solicitudes
  document.getElementById('lista-solicitudes').innerHTML = datosSolicitudes.slice(0, 3).map(s => `
    <li class="solicitud-item">
      ${s.foto
        ? `<img src="${s.foto}" alt="${s.nombre}" class="solicitud-avatar">`
        : `<div class="solicitud-avatar solicitud-avatar--inicial">${iniciales(s.nombre)}</div>`}
      <div class="solicitud-info">
        <strong>${s.nombre}</strong>
        <small>${s.puesto}</small>
      </div>
      <span class="badge badge--${s.estado}">${s.estado.charAt(0).toUpperCase() + s.estado.slice(1)}</span>
    </li>
  `).join('');

  // Vacantes activas
  document.getElementById('lista-vacantes').innerHTML = datosResumen.vacantesActivas.map(p => `
    <li class="vacante-item">
      <div>
        <strong>${p.titulo}</strong>
        <small>${p.detalle}</small>
      </div>
      <div class="vacante-cantidad">
        <strong>${p.solicitudes}</strong>
        <small>solicitudes</small>
      </div>
    </li>
  `).join('');

  // Banner de alerta (solo si hay pendientes)
  const pendientes = datosSidebar.solicitudesPendientes;
  const banner = document.getElementById('banner-alerta');
  if (pendientes > 0) {
    banner.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <div class="banner-texto">
        <strong>Tienes ${pendientes} solicitudes pendientes de revisar</strong>
        <small>Revísalas pronto para no hacer esperar a los voluntarios</small>
      </div>
      <a href="solicitudesong.html" class="btn-oscuro">Revisar ahora</a>
    `;
  } else {
    banner.style.display = 'none';
  }
}

// ===== MI PERFIL =====
let editandoPerfil = false;

function cargarPerfil() {
  // Sincronizar con el override demo si fue modificado
  try {
    const override = JSON.parse(localStorage.getItem('va_demo_ong_override') || 'null');
    if (override) {
      if (override.barrio) datosPerfil.ciudad = override.barrio;
      if (override.lat) datosPerfil.lat = Number(override.lat);
      if (override.lng) datosPerfil.lng = Number(override.lng);
      if (override.nombre) datosPerfil.nombre = override.nombre;
    }
  } catch {}

  // Banner
  document.getElementById('perfil-banner-img').src = datosPerfil.banner;

  // Opciones de categoría
  document.getElementById('perfil-categoria').innerHTML = datosPerfil.categorias.map(c =>
    `<option value="${c}" ${c === datosPerfil.categoria ? 'selected' : ''}>${c}</option>`
  ).join('');

  // Campos del formulario
  document.getElementById('perfil-nombre').value = datosPerfil.nombre;
  document.getElementById('perfil-ciudad').value = datosPerfil.ciudad;
  document.getElementById('perfil-telefono').value = datosPerfil.telefono;
  document.getElementById('perfil-web').value = datosPerfil.sitioWeb;
  document.getElementById('perfil-mision').value = datosPerfil.mision;

  const inputCiudad = document.getElementById('perfil-ciudad');
  if (inputCiudad && window.conectarAutocompletadoUbicacion && !inputCiudad.dataset.autocompleteInit) {
    inputCiudad.dataset.autocompleteInit = 'true';
    window.conectarAutocompletadoUbicacion(inputCiudad, {
      lista: '#perfil-ciudad-sugerencias',
      onSelect: (item, info) => {
        datosPerfil.ciudad = info.etiqueta;
        if (info.lat && info.lon) {
          datosPerfil.lat = parseFloat(info.lat);
          datosPerfil.lng = parseFloat(info.lon);
        }
      }
    });
  }

  renderBotonEditar();
  renderCuenta();
  renderBotonDonarPerfil();
}

function renderBotonEditar() {
  document.getElementById('btn-editar').innerHTML = editandoPerfil
    ? `${iconos.guardar}Guardar cambios`
    : `${iconos.editar}Editar perfil`;
}

function renderCuenta() {
  const items = [
    { icono: 'correo', texto: datosPerfil.email },
    { icono: 'web',       texto: datosPerfil.sitioWeb },
    { icono: 'telefono',  texto: datosPerfil.telefono },
    { icono: 'ubicacion', texto: datosPerfil.ciudad }
  ];

  document.getElementById('cuenta-lista').innerHTML = items.map(i => `
    <li class="cuenta-item">${iconos[i.icono]}<span>${i.texto}</span></li>
  `).join('');
}

function toggleEdicionPerfil() {
  if (editandoPerfil) guardarPerfil();

  editandoPerfil = !editandoPerfil;
  document.getElementById('perfil-campos').disabled = !editandoPerfil;
  renderBotonEditar();

  if (editandoPerfil) document.getElementById('perfil-nombre').focus();
}

async function guardarPerfil() {
  datosPerfil.nombre = document.getElementById('perfil-nombre').value.trim();
  datosPerfil.categoria = document.getElementById('perfil-categoria').value;
  datosPerfil.ciudad = document.getElementById('perfil-ciudad').value.trim();
  datosPerfil.telefono = document.getElementById('perfil-telefono').value.trim();
  datosPerfil.sitioWeb = document.getElementById('perfil-web').value.trim();
  datosPerfil.mision = document.getElementById('perfil-mision').value.trim();

  // Geocodificar si se editó la ubicación manualmente
  if (!datosPerfil.lat || !datosPerfil.lng || datosPerfil._ultimaCiudadGeocodificada !== datosPerfil.ciudad) {
    try {
      const query = encodeURIComponent(`${datosPerfil.ciudad}, Argentina`);
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: { 'Accept-Language': 'es' }
      });
      const geoData = await geoRes.json();
      if (Array.isArray(geoData) && geoData.length > 0) {
        datosPerfil.lat = parseFloat(geoData[0].lat);
        datosPerfil.lng = parseFloat(geoData[0].lon);
        datosPerfil._ultimaCiudadGeocodificada = datosPerfil.ciudad;
      }
    } catch (err) {
      console.warn('Geocodificación perfil:', err);
    }
  }

  // Mantener sincronizado el nombre en sidebar y header
  datosSidebar.organizacion = datosPerfil.nombre;
  cargarSidebar();
  cargarHeader();
  renderCuenta();
  renderBotonDonarPerfil();

  // Guardar en override del mapa para que se actualice la ubicación de esta ONG en el mapa
  try {
    const override = {
      email: datosPerfil.email || 'contacto@cruzroja.org.ar',
      nombre: datosPerfil.nombre,
      barrio: datosPerfil.ciudad,
      lat: datosPerfil.lat || -34.5731,
      lng: datosPerfil.lng || -58.4220,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('va_demo_ong_override', JSON.stringify(override));

    const ongs = JSON.parse(localStorage.getItem('va_ongs_demo') || '[]');
    const idx = ongs.findIndex(o => o.ownerEmail === override.email || (o.nombrePublico && o.nombrePublico.toLowerCase().includes('cruz roja')));
    if (idx >= 0) {
      ongs[idx].barrio = override.barrio;
      ongs[idx].lat = override.lat;
      ongs[idx].lng = override.lng;
      ongs[idx].nombrePublico = override.nombre;
    } else {
      ongs.push({
        ownerEmail: override.email,
        nombrePublico: override.nombre,
        barrio: override.barrio,
        lat: override.lat,
        lng: override.lng,
        verificada: true,
        esDemo: true
      });
    }
    localStorage.setItem('va_ongs_demo', JSON.stringify(ongs));
  } catch {}
}

function renderBotonDonarPerfil() {
  const btn = document.getElementById('btn-donar-ong-perfil');
  if (!btn) return;

  const metodoLink = (datosDonaciones.metodos || []).find(m => m.id === 'link');
  const rawUrl = metodoLink ? metodoLink.valor : '';
  const mpValido = (window.DonarONG && window.DonarONG.validarLink)
    ? window.DonarONG.validarLink(rawUrl)
    : null;

  // Solo se muestra si la ONG tiene habilitadas las donaciones públicas Y un link de Mercado Pago válido
  if (datosDonaciones.publicas && mpValido) {
    btn.style.display = 'inline-flex';
    btn.onclick = () => {
      if (window.DonarONG) {
        window.DonarONG.abrir({
          nombre: datosPerfil.nombre,
          mpLink: mpValido,
        });
      }
    };
  } else {
    btn.style.display = 'none';
    btn.onclick = null;
  }

  console.log("Perfil guardado:", datosPerfil);
  // después: enviar datosPerfil al backend (PUT /api/perfil)
}

// ===== VACANTES =====
function cargarVacantes() {
  document.getElementById('btn-nueva-vacante').innerHTML = `${iconos.vacantes}Nueva vacante`;
  renderVacantes();
}

function renderVacantes() {
  const contenedor = document.getElementById('vacantes-lista');

  if (datosVacantes.length === 0) {
    contenedor.innerHTML = `<p class="estado-vacio">Todavía no publicaste ninguna vacante.</p>`;
  } else {
    contenedor.innerHTML = datosVacantes.map(v => {
      const activa = v.estado === 'activa';
      return `
        <article class="vacante-card ${activa ? '' : 'vacante-card--inactiva'}">
          <div class="vacante-card-info">
            <div class="vacante-card-titulo">
              <h3>${escaparHTML(v.titulo)}</h3>
              <span class="badge badge--${v.estado}">${activa ? 'Activa' : 'Inactiva'}</span>
            </div>
            <div class="vacante-meta">
              <span>${iconos.reloj}${v.horas}h/semana</span>
              <span>${iconos.ubicacion}${v.modalidad}</span>
              <span>${iconos.voluntarios}${v.solicitudes} solicitudes</span>
            </div>
          </div>
          <div class="vacante-acciones">
            <button type="button" class="btn-borde" onclick="cambiarEstadoVacante(${v.id})">${activa ? 'Pausar' : 'Activar'}</button>
            <button type="button" class="btn-icono btn-icono--peligro" onclick="eliminarVacante(${v.id})" aria-label="Eliminar vacante">${iconos.papelera}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  // El número rojo del menú lateral cuenta las vacantes activas
  datosSidebar.vacantesPendientes = datosVacantes.filter(v => v.estado === 'activa').length;
  cargarSidebar();
}

function cambiarEstadoVacante(id) {
  const vacante = datosVacantes.find(v => v.id === id);
  vacante.estado = vacante.estado === 'activa' ? 'inactiva' : 'activa';
  renderVacantes();
  // después: enviar el cambio al backend (PATCH /api/vacantes/:id)
}

function eliminarVacante(id) {
  const indice = datosVacantes.findIndex(v => v.id === id);
  if (!confirm(`¿Eliminar la vacante "${datosVacantes[indice].titulo}"?`)) return;
  datosVacantes.splice(indice, 1);
  renderVacantes();
  // después: DELETE /api/vacantes/:id
}

const modalidadesVacante = ["Presencial", "Remoto", "Mixto"];

function nuevaVacante() {
  abrirModal('Nueva vacante', `
    <div class="config-campos">
      <div class="campo">
        <label for="vacante-titulo">Título</label>
        <input type="text" id="vacante-titulo" maxlength="80" placeholder="Ej: Coordinador de emergencias">
      </div>

      <div class="form-grid">
        <div class="campo">
          <label for="vacante-horas">Horas por semana</label>
          <input type="number" id="vacante-horas" min="1" max="40" placeholder="Ej: 10">
        </div>
        <div class="campo">
          <label for="vacante-modalidad">Modalidad</label>
          <select id="vacante-modalidad">
            ${modalidadesVacante.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="campo">
        <label for="vacante-descripcion">Descripción</label>
        <textarea id="vacante-descripcion" rows="4" maxlength="500" placeholder="Describe las tareas que hará el voluntario"></textarea>
      </div>
    </div>

    <div class="modal-acciones">
      <p id="vacante-mensaje" class="config-mensaje config-mensaje--error" role="alert"></p>
      <button type="button" class="btn-borde" onclick="cerrarModal()">Cancelar</button>
      <button type="button" class="btn-primario" onclick="guardarNuevaVacante()">Publicar vacante</button>
    </div>
  `);

  document.getElementById('vacante-titulo').focus();
}

function guardarNuevaVacante() {
  const titulo = document.getElementById('vacante-titulo').value.trim();
  const horas = parseInt(document.getElementById('vacante-horas').value, 10);
  const modalidad = document.getElementById('vacante-modalidad').value;
  const descripcion = document.getElementById('vacante-descripcion').value.trim();
  const mensaje = document.getElementById('vacante-mensaje');

  if (titulo.length < 3) {
    mensaje.textContent = 'Escribe un título (mínimo 3 caracteres).';
    return;
  }
  if (!(horas >= 1 && horas <= 40)) {
    mensaje.textContent = 'Las horas por semana deben estar entre 1 y 40.';
    return;
  }

  const nuevoId = datosVacantes.reduce((mayor, v) => Math.max(mayor, v.id), 0) + 1;
  datosVacantes.unshift({ id: nuevoId, titulo, horas, modalidad, descripcion, solicitudes: 0, estado: 'activa' });

  cerrarModal();
  renderVacantes();
  // después: enviar la vacante al backend (POST /api/vacantes)
}

// ===== SOLICITUDES =====
let filtroSolicitudes = 'todas';

const estadosSolicitud = {
  pendiente: { texto: 'Pendiente', icono: 'reloj' },
  aceptada:  { texto: 'Aceptada',  icono: 'aceptar' },
  rechazada: { texto: 'Rechazada', icono: 'rechazar' }
};

const filtrosSolicitudes = [
  { id: 'todas',     texto: 'Todas' },
  { id: 'pendiente', texto: 'Pendientes' },
  { id: 'aceptada',  texto: 'Aceptadas' },
  { id: 'rechazada', texto: 'Rechazadas' }
];

function contarSolicitudes(estado) {
  return estado === 'todas'
    ? datosSolicitudes.length
    : datosSolicitudes.filter(s => s.estado === estado).length;
}

function cargarSolicitudes() {
  renderSolicitudes();
}

function renderSolicitudes() {
  const pendientes = contarSolicitudes('pendiente');

  // Subtítulo
  document.getElementById('solicitudes-subtitulo').textContent =
    `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'} de ${datosSolicitudes.length} en total`;

  // Filtros con contador
  document.getElementById('solicitudes-filtros').innerHTML = filtrosSolicitudes.map(f => `
    <button type="button" class="filtro-btn ${filtroSolicitudes === f.id ? 'filtro-btn--activo' : ''}" onclick="filtrarSolicitudes('${f.id}')">
      ${f.texto}<span class="filtro-conteo">${contarSolicitudes(f.id)}</span>
    </button>
  `).join('');

  // Lista
  const visibles = filtroSolicitudes === 'todas'
    ? datosSolicitudes
    : datosSolicitudes.filter(s => s.estado === filtroSolicitudes);

  document.getElementById('solicitudes-lista').innerHTML = visibles.length === 0
    ? `<p class="estado-vacio">No hay solicitudes en esta categoría.</p>`
    : visibles.map(s => {
        const estado = estadosSolicitud[s.estado];
        return `
          <article class="solicitud-card">
            ${s.foto
              ? `<img src="${s.foto}" alt="${s.nombre}" class="solicitud-avatar solicitud-avatar--grande">`
              : `<div class="solicitud-avatar solicitud-avatar--inicial solicitud-avatar--grande">${iniciales(s.nombre)}</div>`}
            <div class="solicitud-card-info">
              <div class="solicitud-card-titulo">
                <h3>${s.nombre}</h3>
                <span class="badge badge--${s.estado}">${iconos[estado.icono]}${estado.texto}</span>
              </div>
              <p class="solicitud-puesto">${s.puesto}</p>
              <div class="solicitud-meta">
                <span>${iconos.correo}${s.email}</span>
                <span>${iconos.reloj}${s.disponibilidad}</span>
                <span>${iconos.calendario}${s.fecha}</span>
              </div>
            </div>
            ${s.estado === 'pendiente' ? `
              <div class="solicitud-acciones">
                <button type="button" class="btn-primario btn-primario--sm" onclick="responderSolicitud(${s.id}, 'aceptada')">${iconos.aceptar}Aceptar</button>
                <button type="button" class="btn-borde btn-borde--peligro" onclick="responderSolicitud(${s.id}, 'rechazada')">${iconos.rechazar}Rechazar</button>
              </div>
            ` : ''}
            <button type="button" class="btn-icono btn-icono--suave" onclick="verSolicitud(${s.id})" aria-label="Ver detalle">${iconos.flecha}</button>
          </article>
        `;
      }).join('');

  // El número rojo del menú lateral cuenta las solicitudes pendientes
  datosSidebar.solicitudesPendientes = pendientes;
  cargarSidebar();
}

function filtrarSolicitudes(filtro) {
  filtroSolicitudes = filtro;
  renderSolicitudes();
}

function responderSolicitud(id, nuevoEstado) {
  const solicitud = datosSolicitudes.find(s => s.id === id);
  solicitud.estado = nuevoEstado;
  renderSolicitudes();
  // después: enviar la respuesta al backend (PATCH /api/solicitudes/:id)
}

function verSolicitud(id) {
  const s = datosSolicitudes.find(sol => sol.id === id);
  const estado = estadosSolicitud[s.estado];
  const pendiente = s.estado === 'pendiente';

  abrirModal('Solicitud de voluntariado', `
    <div class="detalle-persona">
      ${s.foto
        ? `<img src="${escaparHTML(s.foto)}" alt="${escaparHTML(s.nombre)}" class="solicitud-avatar solicitud-avatar--grande">`
        : `<div class="solicitud-avatar solicitud-avatar--inicial solicitud-avatar--grande">${escaparHTML(iniciales(s.nombre))}</div>`}
      <div>
        <h4>${escaparHTML(s.nombre)}</h4>
        <a href="mailto:${escaparHTML(s.email)}">${escaparHTML(s.email)}</a>
      </div>
    </div>

    <dl class="detalle-datos">
      <div class="detalle-fila"><dt>Vacante</dt><dd>${escaparHTML(s.puesto)}</dd></div>
      <div class="detalle-fila"><dt>Disponibilidad</dt><dd>${escaparHTML(s.disponibilidad)}</dd></div>
      <div class="detalle-fila"><dt>Fecha de solicitud</dt><dd>${escaparHTML(s.fecha)}</dd></div>
      <div class="detalle-fila"><dt>Estado</dt><dd><span class="badge badge--${s.estado}">${iconos[estado.icono]}${estado.texto}</span></dd></div>
    </dl>

    <div class="modal-acciones">
      ${pendiente ? `
        <button type="button" class="btn-borde btn-borde--peligro" onclick="responderSolicitud(${s.id}, 'rechazada'); cerrarModal()">${iconos.rechazar}Rechazar</button>
        <button type="button" class="btn-primario" onclick="responderSolicitud(${s.id}, 'aceptada'); cerrarModal()">${iconos.aceptar}Aceptar</button>
      ` : `
        <button type="button" class="btn-borde" onclick="cerrarModal()">Cerrar</button>
      `}
    </div>
  `);
  // después: pedir al backend el detalle completo (GET /api/solicitudes/:id)
}

// ===== VOLUNTARIOS =====
function cargarVoluntarios() {
  const total = datosVoluntarios.length;
  const horas = datosVoluntarios.reduce((suma, v) => suma + v.horas, 0);
  const media = total > 0 ? Math.round(horas / total) : 0;

  // Subtítulo
  document.getElementById('voluntarios-subtitulo').textContent =
    `${total} ${total === 1 ? 'persona contribuyendo' : 'personas contribuyendo'} actualmente`;

  // Totales
  const totales = [
    { valor: total,         etiqueta: 'Total voluntarios' },
    { valor: `${horas}h`,   etiqueta: 'Horas donadas' },
    { valor: `${media}h`,   etiqueta: 'Media por voluntario' }
  ];

  document.getElementById('voluntarios-stats').innerHTML = totales.map(t => `
    <article class="card voluntarios-stat">
      <strong>${t.valor}</strong>
      <span>${t.etiqueta}</span>
    </article>
  `).join('');

  // Lista
  document.getElementById('voluntarios-lista').innerHTML = total === 0
    ? `<p class="estado-vacio">Todavía no tenés voluntarios activos.</p>`
    : datosVoluntarios.map(v => `
        <article class="voluntario-card">
          ${v.foto
            ? `<img src="${v.foto}" alt="${v.nombre}" class="solicitud-avatar solicitud-avatar--grande solicitud-avatar--cuadrado">`
            : `<div class="solicitud-avatar solicitud-avatar--inicial solicitud-avatar--grande solicitud-avatar--cuadrado">${iniciales(v.nombre)}</div>`}
          <div class="voluntario-info">
            <h3>${v.nombre}</h3>
            <p class="voluntario-rol">${v.rol}</p>
            <span class="voluntario-desde">${iconos.calendario}Desde ${v.desde}</span>
          </div>
          <div class="voluntario-horas">
            <strong>${v.horas}h</strong>
            <small>donadas</small>
          </div>
          <a href="mailto:${v.email}" class="btn-icono btn-icono--borde" aria-label="Escribir a ${v.nombre}">${iconos.correo}</a>
        </article>
      `).join('');
}

// ===== DONACIONES =====
let editandoDonaciones = false;

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
});

function cargarDonaciones() {
  // Métodos de pago (se dibujan una sola vez para no pisar lo que se esté editando)
  document.getElementById('donaciones-metodos').innerHTML = datosDonaciones.metodos.map(m => `
    <div class="campo donaciones-metodo">
      <label for="metodo-${m.id}">
        ${m.icono
          ? iconos[m.icono]
          : `<span class="pago-logo pago-logo--${m.logo}">${m.letra}</span>`}
        ${m.etiqueta}
      </label>
      <div class="campo-copiar">
        <input type="text" id="metodo-${m.id}" class="${m.mono ? 'input--mono' : ''}" value="${m.valor}" readonly>
        <button type="button" class="btn-icono btn-icono--borde" onclick="copiarMetodo('${m.id}', this)" aria-label="Copiar">${iconos.copiar}</button>
      </div>
    </div>
  `).join('');

  document.getElementById('donaciones-objetivo').value = datosDonaciones.objetivo;

  renderDonacionesPublicas();
  renderDonacionesResumen();
  renderBotonEditarDonaciones();
}

function renderDonacionesPublicas() {
  const activas = datosDonaciones.publicas;
  const metodoLink = (datosDonaciones.metodos || []).find(m => m.id === 'link');
  const mpValido = (window.DonarONG && window.DonarONG.validarLink)
    ? window.DonarONG.validarLink(metodoLink ? metodoLink.valor : '')
    : null;
  const tieneMP = activas && mpValido;

  document.getElementById('donaciones-publicas').innerHTML = `
    <div class="donaciones-icono">${iconos.donaciones}</div>
    <div class="donaciones-publicas-texto">
      <strong>Donaciones públicas</strong>
      <small>${activas
        ? (mpValido ? 'Los usuarios verán el botón "❤️ Donar" en tu perfil del mapa vinculado a tu Mercado Pago' : 'Activas, pero falta vincular un link de Mercado Pago para mostrar el botón')
        : 'Los usuarios no verán el botón "Donar" en tu perfil del mapa'}</small>
    </div>
    <div style="display:flex;align-items:center;gap:0.75rem;">
      ${tieneMP ? `<button type="button" class="btn-donar-ong" id="btn-probar-donacion" style="width:auto;padding:0.4rem 0.85rem;font-size:13px;">❤️ Probar botón</button>` : ''}
      <button type="button" class="switch" role="switch" aria-checked="${activas}" aria-label="Activar donaciones públicas" onclick="toggleDonacionesPublicas()"></button>
    </div>
  `;

  if (tieneMP) {
    document.getElementById('btn-probar-donacion')?.addEventListener('click', () => {
      window.DonarONG?.abrir({
        nombre: datosPerfil.nombre,
        mpLink: mpValido,
      });
    });
  }
}

function renderDonacionesResumen() {
  const { recaudado, objetivo } = datosDonaciones;
  const porcentaje = objetivo > 0 ? Math.round((recaudado / objetivo) * 100) : 0;

  // Tarjetas de totales
  const totales = [
    { icono: 'tendencia',  valor: formatoPesos.format(recaudado), etiqueta: 'Total recaudado' },
    { icono: 'donaciones', valor: formatoPesos.format(objetivo),  etiqueta: 'Objetivo' },
    { icono: 'resumen',    valor: `${porcentaje}%`,               etiqueta: '% alcanzado' }
  ];

  document.getElementById('donaciones-stats').innerHTML = totales.map(t => `
    <article class="stat-card">
      <div class="stat-icono stat-icono--plano">${iconos[t.icono]}</div>
      <strong class="stat-numero">${t.valor}</strong>
      <span class="stat-label">${t.etiqueta}</span>
    </article>
  `).join('');

  // Barra de progreso
  document.getElementById('donaciones-progreso').innerHTML = `
    <div class="progreso-cabecera">
      <strong>${formatoPesos.format(recaudado)} recaudados</strong>
      <span>de ${formatoPesos.format(objetivo)}</span>
    </div>
    <div class="progreso-barra">
      <div class="progreso-relleno" style="width: ${Math.min(porcentaje, 100)}%"></div>
    </div>
    <small>${porcentaje}% del objetivo alcanzado</small>
  `;
}

function renderBotonEditarDonaciones() {
  document.getElementById('btn-editar-donaciones').innerHTML = editandoDonaciones
    ? `${iconos.guardar}Guardar cambios`
    : `${iconos.editar}Editar`;
}

function toggleDonacionesPublicas() {
  datosDonaciones.publicas = !datosDonaciones.publicas;
  renderDonacionesPublicas();
  // después: enviar el cambio al backend (PATCH /api/donaciones)
}

function toggleEdicionDonaciones() {
  if (editandoDonaciones) guardarDonaciones();

  editandoDonaciones = !editandoDonaciones;
  document.querySelectorAll('.donaciones-config input').forEach(input => {
    input.readOnly = !editandoDonaciones;
  });
  renderBotonEditarDonaciones();
}

function guardarDonaciones() {
  // Métodos de pago
  datosDonaciones.metodos.forEach(m => {
    m.valor = document.getElementById(`metodo-${m.id}`).value.trim();
  });

  // Objetivo: solo se acepta un número mayor a 0
  const campoObjetivo = document.getElementById('donaciones-objetivo');
  const objetivo = parseInt(campoObjetivo.value.replace(/\D/g, ''), 10);
  if (objetivo > 0) datosDonaciones.objetivo = objetivo;
  campoObjetivo.value = datosDonaciones.objetivo;

  renderDonacionesResumen();
  renderDonacionesPublicas();
  console.log("Donaciones guardadas:", datosDonaciones);
  // después: enviar datosDonaciones al backend (PUT /api/donaciones)
}

async function copiarMetodo(id, boton) {
  const valor = document.getElementById(`metodo-${id}`).value;
  try {
    await navigator.clipboard.writeText(valor);
    boton.innerHTML = iconos.guardar;
    setTimeout(() => { boton.innerHTML = iconos.copiar; }, 1500);
  } catch (error) {
    console.error("No se pudo copiar:", error);
  }
}

// ===== CONFIGURACIÓN =====
function cargarConfiguracion() {
  document.getElementById('config-email').value = datosSidebar.email;
  document.getElementById('btn-eliminar-cuenta').innerHTML = `${iconos.papelera}Eliminar mi cuenta`;
  renderConfiguracion('notificaciones');
  renderConfiguracion('visibilidad');
}

function renderConfiguracion(grupo) {
  document.getElementById(`config-${grupo}`).innerHTML = datosConfiguracion[grupo].map(c => `
    <div class="config-fila">
      <div class="config-fila-texto">
        <strong>${c.titulo}</strong>
        <small>${c.descripcion}</small>
      </div>
      <button type="button" class="switch" role="switch" aria-checked="${c.activa}" aria-label="${c.titulo}" onclick="toggleConfiguracion('${grupo}', '${c.id}')"></button>
    </div>
  `).join('');
}

function toggleConfiguracion(grupo, id) {
  const opcion = datosConfiguracion[grupo].find(c => c.id === id);
  opcion.activa = !opcion.activa;
  renderConfiguracion(grupo);
  // después: enviar el cambio al backend (PATCH /api/configuracion)
}

function mostrarMensajeConfiguracion(texto, tipo) {
  const mensaje = document.getElementById('config-mensaje');
  mensaje.textContent = texto;
  mensaje.className = `config-mensaje config-mensaje--${tipo}`;
}

function guardarCuenta() {
  const email = document.getElementById('config-email').value.trim();
  const actual = document.getElementById('config-clave-actual').value;
  const nueva = document.getElementById('config-clave-nueva').value;
  const repetida = document.getElementById('config-clave-repetida').value;

  // Validar email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    mostrarMensajeConfiguracion('Ingresa un email válido.', 'error');
    return;
  }

  // Validar contraseña (solo si se completó alguno de los campos)
  const cambiaClave = actual || nueva || repetida;
  if (cambiaClave) {
    if (!actual || !nueva || !repetida) {
      mostrarMensajeConfiguracion('Completa los tres campos para cambiar la contraseña.', 'error');
      return;
    }
    if (nueva.length < 8) {
      mostrarMensajeConfiguracion('La nueva contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    if (nueva !== repetida) {
      mostrarMensajeConfiguracion('La nueva contraseña y su repetición no coinciden.', 'error');
      return;
    }
  }

  // Guardar el email y mantener sincronizado el menú lateral
  datosSidebar.email = email;
  datosPerfil.email = email;
  cargarSidebar();

  // Limpiar los campos de contraseña
  ['config-clave-actual', 'config-clave-nueva', 'config-clave-repetida'].forEach(id => {
    document.getElementById(id).value = '';
  });

  mostrarMensajeConfiguracion(cambiaClave ? 'Cambios guardados. Tu contraseña fue actualizada.' : 'Cambios guardados.', 'ok');
  // después: enviar al backend (PUT /api/cuenta). La contraseña nunca se guarda ni se muestra en el front.
}

function eliminarCuenta() {
  if (!confirm('¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')) return;
  console.log("Cuenta eliminada");
  // después: DELETE /api/cuenta, borrar el token y redirigir a login.html
}

// ===== INICIO =====
document.addEventListener('DOMContentLoaded', () => {
  cargarSidebar();
  cargarHeader();

  const pagina = document.body.dataset.page;
  if (pagina === 'resumen') cargarResumen();
  if (pagina === 'perfil') cargarPerfil();
  if (pagina === 'vacantes') cargarVacantes();
  if (pagina === 'solicitudes') cargarSolicitudes();
  if (pagina === 'voluntarios') cargarVoluntarios();
  if (pagina === 'donaciones') cargarDonaciones();
  if (pagina === 'configuracion') cargarConfiguracion();
});