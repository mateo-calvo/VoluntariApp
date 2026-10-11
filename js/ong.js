// ===== DATOS DINÁMICOS (por ahora fijos, después vienen de una API/backend) =====
const datosSidebar = {
  organizacion: "Cruz Roja Argentina",
  email: "testong@gmail.com",
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

// ===== ÍCONOS SVG =====
const iconos = {
  resumen: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14"/></svg>`,
  perfil: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  vacantes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  solicitudes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  voluntarios: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  donaciones: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  configuracion: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`
};

// ===== SIDEBAR =====
function cargarSidebar() {
  const paginaActual = document.body.dataset.page;
  const esActiva = (pagina) => paginaActual === pagina ? "active" : "";

  const sidebarHTML = `
    <aside class="sidebar">
      <div class="sidebar-logo">
  <img src="../../images/logo.png" alt="VoluntariApp" class="logo-img">
  
</div>

      <div class="sidebar-org">
        <div class="org-avatar">${datosSidebar.organizacion.charAt(0)}</div>
        <div class="org-info">
          <strong>${datosSidebar.organizacion}</strong>
          <small>${datosSidebar.email}</small>
        </div>
      </div>
      ${datosSidebar.verificada ? '<span class="badge-verificada">● ONG Verificada</span>' : ''}

      <nav class="sidebar-nav">
        <a href="resumen.html" class="${esActiva('resumen')}">${iconos.resumen}<span>Resumen</span></a>
        <a href="perfil.html" class="${esActiva('perfil')}">${iconos.perfil}<span>Mi perfil</span></a>
        <a href="vacantes.html" class="${esActiva('vacantes')}">${iconos.vacantes}<span>Vacantes</span>
          ${datosSidebar.vacantesPendientes > 0 ? `<span class="badge-nav">${datosSidebar.vacantesPendientes}</span>` : ''}
        </a>
        <a href="solicitudes.html" class="${esActiva('solicitudes')}">${iconos.solicitudes}<span>Solicitudes</span>
          ${datosSidebar.solicitudesPendientes > 0 ? `<span class="badge-nav">${datosSidebar.solicitudesPendientes}</span>` : ''}
        </a>
        <a href="voluntarios.html" class="${esActiva('voluntarios')}">${iconos.voluntarios}<span>Voluntarios</span></a>
        <a href="donaciones.html" class="${esActiva('donaciones')}">${iconos.donaciones}<span>Donaciones</span></a>
      </nav>

      <div class="sidebar-bottom">
        <a href="configuracion.html" class="${esActiva('configuracion')}">${iconos.configuracion}<span>Configuración</span></a>
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
      <div class="topbar-titulo">
        <h1>${tituloTexto}</h1>
        <small>Panel de administración · ${datosSidebar.organizacion}</small>
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
            <a href="solicitudes.html" class="dropdown-footer">Ver todas</a>
          </div>
        </div>

        <div class="avatar-wrapper">
          <button class="avatar-btn" onclick="toggleDropdown('avatar-dropdown')">
            ${datosSidebar.organizacion.charAt(0)}
          </button>
          <div id="avatar-dropdown" class="dropdown hidden">
            <a href="perfil.html">Ver perfil</a>
            <a href="configuracion.html">Configuración</a>
            <a href="#" onclick="cerrarSesion()">Cerrar sesión</a>
          </div>
        </div>
      </div>
    </header>
  `;

  document.getElementById('header-container').innerHTML = headerHTML;
}

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
  console.log("Cerrando sesión...");
  // después: borrar token/localStorage y redirigir a login
}

// ===== INICIO =====
document.addEventListener('DOMContentLoaded', () => {
  cargarSidebar();
  cargarHeader();
});