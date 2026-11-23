/* =========================================================
   Generador de exámenes — Interfaz
   ========================================================= */
(function () {
  'use strict';
  const CLAVE = 'generador-examenes.v1';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIPOS = {
    numerica: { icono: '🔢', nombre: 'Numérica' }, opcion: { icono: '🔘', nombre: 'Opción múltiple' },
    vf: { icono: '✔', nombre: 'Verdadero / falso' }, corta: { icono: '✏', nombre: 'Respuesta corta' }, ensayo: { icono: '📝', nombre: 'Ensayo' }
  };
  let banco = { nombre: '', preguntas: [] };
  let sel = -1;
  let semillaPrevia = 1;

  /* ---------- utilidades ---------- */
  function toast(msg, error) {
    const t = document.createElement('div');
    t.className = 'toast' + (error ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), error ? 5000 : 2800);
  }
  function descargar(texto, nombre, tipo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: tipo + ';charset=utf-8' }));
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const nombreArchivo = s => (s || 'banco').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'banco';
  const nuevoId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function matematicas(el) {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(el, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
      } catch (e) { /* fórmula mal escrita: se deja como texto */ }
    }
  }

  /* ---------- persistencia ---------- */
  let tGuardar = null;
  function guardarYa() {
    clearTimeout(tGuardar); tGuardar = null;
    try { localStorage.setItem(CLAVE, JSON.stringify(banco)); } catch (e) { /* almacenamiento no disponible */ }
  }
  function cambio() { clearTimeout(tGuardar); tGuardar = setTimeout(guardarYa, 400); }
  window.addEventListener('beforeunload', () => { if (tGuardar) guardarYa(); });
  function cargarBanco(b) {
    if (!b || !Array.isArray(b.preguntas)) throw new Error('formato no reconocido');
    banco = { nombre: b.nombre || '', preguntas: b.preguntas.map(q => Object.assign(plantilla(q.tipo || 'numerica'), q, { id: q.id || nuevoId() })) };
    sel = banco.preguntas.length ? 0 : -1;
    $('#nombreBanco').value = banco.nombre;
    semillaPrevia = 1;
    renderTodo(); cambio();
  }

  /* ---------- pregunta nueva ---------- */
  function plantilla(tipo) {
    const base = { id: nuevoId(), tipo, nombre: '', categoria: 'General', puntos: 1, variantes: 10, enunciado: '', variables: '', condicion: '', retro: '' };
    if (tipo === 'numerica') Object.assign(base, { respuesta: '', tolerancia: '0', tolTipo: 'absoluta', unidad: '' });
    if (tipo === 'opcion') Object.assign(base, { correcta: '', distractores: '', barajar: true, restaIncorrecta: false });
    if (tipo === 'vf') Object.assign(base, { condicionVF: 'verdadero' });
    if (tipo === 'corta') Object.assign(base, { aceptadas: '', mayusculas: false, variantes: 1 });
    if (tipo === 'ensayo') Object.assign(base, { adjuntos: false, variantes: 1, puntos: 2 });
    return base;
  }
  function agregar(tipo) {
    const q = plantilla(tipo);
    q.nombre = `${TIPOS[tipo].nombre} ${banco.preguntas.length + 1}`;
    if (sel >= 0 && banco.preguntas[sel]) q.categoria = banco.preguntas[sel].categoria;
    banco.preguntas.push(q);
    sel = banco.preguntas.length - 1;
    renderTodo(); cambio();
    setTimeout(() => { const e = document.querySelector('[data-k=enunciado]'); if (e) e.focus(); }, 30);
  }

  /* ---------- lista ---------- */
  function errorDe(q) {
    try { Motor.instanciar(q, Motor.crearRng(7)); return null; }
    catch (e) { return e.repetidas ? null : e.message; }
  }
  function renderLista() {
    const ul = $('#lista');
    $('#nPreg').textContent = banco.preguntas.length;
    if (!banco.preguntas.length) {
      ul.innerHTML = `<li class="vacio" style="display:block;cursor:default">Aún no hay preguntas.<br>Pulsa <b>＋ Nueva</b> o carga el <b>🧪 Ejemplo</b> para ver cómo funciona.</li>`;
    } else {
      ul.innerHTML = banco.preguntas.map((q, i) => {
        const err = errorDe(q);
        return `<li data-i="${i}" class="${i === sel ? 'activa' : ''}${err ? ' error' : ''}" title="${esc(err || q.nombre)}">
          <span>${TIPOS[q.tipo].icono}</span><span class="t">${esc(q.nombre || '(sin nombre)')}</span><span class="n">${(q.variables || '').trim() && q.tipo !== 'ensayo' ? '×' + q.variantes : '1'}</span>
          <span class="s">${err ? '⚠ ' + esc(err) : esc(q.categoria || 'General')}</span></li>`;
      }).join('');
      ul.querySelectorAll('li[data-i]').forEach(li => li.onclick = () => { sel = +li.dataset.i; semillaPrevia = 1; renderTodo(); });
    }
    const total = banco.preguntas.reduce((s, q) => s + ((q.variables || '').trim() && q.tipo !== 'ensayo' ? (+q.variantes || 1) : 1), 0);
    const cats = new Set(banco.preguntas.map(q => q.categoria || 'General')).size;
    $('#resumen').innerHTML = banco.preguntas.length ? `${banco.preguntas.length} plantillas · ${cats} categoría${cats > 1 ? 's' : ''} · hasta ${total} preguntas al exportar` : '';
  }

  /* ---------- editor ---------- */
  const campo = (k, label, html, ayuda) => `<div class="campo"><label for="c_${k}">${label}</label>${html}${ayuda ? `<small>${ayuda}</small>` : ''}</div>`;
  const inp = (k, v, extra = '') => `<input id="c_${k}" data-k="${k}" value="${esc(v)}" ${extra}>`;
  const area = (k, v, extra = '') => `<textarea id="c_${k}" data-k="${k}" ${extra}>${esc(v)}</textarea>`;
  const chk = (k, v, label) => `<label class="chk"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}> ${label}</label>`;

  function renderEditor() {
    const ed = $('#editor');
    const q = banco.preguntas[sel];
    if (!q) {
      ed.innerHTML = `<div class="vacio" style="margin-top:40px"><b>Cómo funciona</b><br>1. Crea una pregunta y usa variables como <code>{a}</code> en el enunciado.<br>2. Define cómo se generan: <code>a = randint(2, 9)</code>.<br>3. Escribe la respuesta como fórmula: <code>2*a</code>.<br>4. Exporta: cada estudiante recibirá números distintos en Moodle.<br><br><button class="prim" style="border-radius:7px;padding:7px 14px" id="btnEj">🧪 Ver un ejemplo</button></div>`;
      const b = $('#btnEj'); if (b) b.onclick = () => acciones.ejemplo();
      return;
    }
    const t = q.tipo;
    let h = `<h2>${TIPOS[t].icono} ${esc(TIPOS[t].nombre)}</h2><div class="sub">Los cambios se guardan automáticamente en este navegador.</div>
    <div class="bloque"><h3>Datos generales</h3>
      <div class="fila">
        ${campo('nombre', 'Nombre de la pregunta', inp('nombre', q.nombre, 'placeholder="p. ej. Derivada de un polinomio"'))}
        ${campo('categoria', 'Categoría', inp('categoria', q.categoria, 'list="listaCat" placeholder="p. ej. Unidad 1"'))}
      </div>
      <datalist id="listaCat">${[...new Set(banco.preguntas.map(x => x.categoria).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="fila">
        ${campo('tipo', 'Tipo', `<select id="c_tipo" data-k="tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}"${k === t ? ' selected' : ''}>${v.icono} ${v.nombre}</option>`).join('')}</select>`)}
        ${campo('puntos', 'Puntos', inp('puntos', q.puntos, 'type="number" min="0" step="0.5"'))}
        ${t !== 'ensayo' ? campo('variantes', 'Variantes a generar', inp('variantes', q.variantes, 'type="number" min="1" max="200"'), 'Cuántas versiones distintas se exportan a Moodle.') : ''}
      </div>
    </div>
    <div class="bloque"><h3>Enunciado</h3>
      <div class="herr" data-para="enunciado">
        <button data-ins="\\( | \\)" title="Fórmula dentro del texto">\\( fórmula \\)</button>
        <button data-ins="\\[ | \\]" title="Fórmula centrada">\\[ centrada \\]</button>
        <button data-ins="\\frac{|}{}">fracción</button><button data-ins="\\sqrt{|}">raíz</button><button data-ins="^{|}">potencia</button>
        <button data-ins="\\int_{|}^{} \\, dx">integral</button><button data-ins="\\lim_{x \\to |}">límite</button>
        <button data-ins="{=|}" title="Insertar un cálculo">{=cálculo}</button>
      </div>
      ${area('enunciado', q.enunciado, 'rows="6" placeholder="Escribe la pregunta. Usa {a} para insertar el valor de la variable a, y \\( ... \\) para fórmulas."')}
      <div class="chips" id="chipsVars"></div>
    </div>`;
    if (t !== 'ensayo' || (q.variables || '').trim()) {
      h += `<div class="bloque"><h3>Variables aleatorias</h3>
        ${campo('variables', 'Una por línea:  nombre = expresión', area('variables', q.variables, 'class="codigo" rows="5" spellcheck="false" placeholder="a = randint(2, 9)\nb = randnz(-5, 5)\nnombre = choice(&quot;Ana&quot;, &quot;Luis&quot;)"'),
          'Funciones: <code>randint(a,b)</code> entero, <code>randnz(a,b)</code> entero ≠ 0, <code>randreal(a,b,dec)</code>, <code>randstep(a,b,paso)</code>, <code>choice(x,y,…)</code>. Puedes usar variables anteriores: <code>c = a*b</code>. <code>#</code> inicia un comentario.')}
        ${campo('condicion', 'Condición (opcional)', inp('condicion', q.condicion, 'class="codigo" placeholder="p. ej.  a != b and c > 0"'), 'Se generan valores nuevos hasta que se cumpla.')}
      </div>`;
    }
    h += '<div class="bloque"><h3>Respuesta</h3>';
    if (t === 'numerica') {
      h += campo('respuesta', 'Respuesta correcta (fórmula con las variables)', inp('respuesta', q.respuesta, 'class="codigo" placeholder="p. ej.  2*a*x0 + b"'), 'Usa <code>* / ^</code>, <code>sqrt()</code>, <code>round(x, 2)</code>, <code>ln()</code>, <code>sin()</code>… El estudiante escribe el número.') +
        `<div class="fila">${campo('tolerancia', 'Margen de error', inp('tolerancia', q.tolerancia, 'class="codigo"'))}
        ${campo('tolTipo', 'Tipo de margen', `<select id="c_tolTipo" data-k="tolTipo"><option value="absoluta"${q.tolTipo !== 'relativa' ? ' selected' : ''}>Absoluto (±)</option><option value="relativa"${q.tolTipo === 'relativa' ? ' selected' : ''}>Porcentaje (± %)</option></select>`)}
        ${campo('unidad', 'Unidad (solo se muestra)', inp('unidad', q.unidad, 'placeholder="p. ej. m/s"'))}</div>`;
    } else if (t === 'opcion') {
      h += campo('correcta', '✅ Opción correcta', inp('correcta', q.correcta, 'placeholder="p. ej.  x = {r}"')) +
        campo('distractores', '❌ Opciones incorrectas (una por línea)', area('distractores', q.distractores, 'rows="4" placeholder="x = {=-r}\nx = {=r+1}\nx = {=2*r}"'), 'Si en alguna variante dos opciones coinciden, esa variante se descarta automáticamente.') +
        chk('barajar', q.barajar !== false, 'Barajar el orden de las opciones') + chk('restaIncorrecta', q.restaIncorrecta, 'Las respuestas incorrectas restan puntos');
    } else if (t === 'vf') {
      h += campo('condicionVF', 'El enunciado es verdadero cuando…', inp('condicionVF', q.condicionVF, 'class="codigo" placeholder="p. ej.  m > 0    (o simplemente: verdadero / falso)"'), 'Escribe <code>verdadero</code> o <code>falso</code>, o una condición con las variables para que la respuesta cambie en cada variante.');
    } else if (t === 'corta') {
      h += campo('aceptadas', 'Respuestas aceptadas (una por línea)', area('aceptadas', q.aceptadas, 'rows="3" placeholder="fundamental\nteorema fundamental"'), 'Puedes usar <code>*</code> como comodín (p. ej. <code>*fundamental*</code>). Pueden contener variables: <code>{=a+b}</code>.') +
        chk('mayusculas', q.mayusculas, 'Distinguir mayúsculas y minúsculas');
    } else {
      h += '<p style="margin:0 0 8px;color:var(--suave);font-size:13px">Pregunta abierta: el docente la califica manualmente en Moodle.</p>' + chk('adjuntos', q.adjuntos, 'Permitir adjuntar un archivo (foto del desarrollo, etc.)');
    }
    h += `</div><div class="bloque"><h3>${t === 'ensayo' ? 'Guía para calificar' : 'Retroalimentación (opcional)'}</h3>
      ${area('retro', q.retro, `rows="3" placeholder="${t === 'ensayo' ? 'Criterios de calificación (visibles solo para el docente)' : 'Explicación que verá el estudiante al revisar. Puede usar variables.'}"`)}</div>
      <div class="botones-preg"><button data-b="duplicar">⧉ Duplicar</button><button data-b="subir">↑ Subir</button><button data-b="bajar">↓ Bajar</button><button data-b="eliminar" class="peligro">🗑 Eliminar</button></div>`;
    ed.innerHTML = h;
    ed.querySelectorAll('[data-k]').forEach(el => {
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        const k = el.dataset.k;
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (k === 'puntos') v = parseFloat(v) || 0;
        if (k === 'variantes') v = Math.max(1, Math.min(200, parseInt(v) || 1));
        if (k === 'tipo') {
          const nueva = Object.assign(plantilla(v), { id: q.id, nombre: q.nombre, categoria: q.categoria, puntos: q.puntos, enunciado: q.enunciado, variables: q.variables, condicion: q.condicion, retro: q.retro, variantes: q.variantes });
          banco.preguntas[sel] = nueva; renderTodo(); cambio(); return;
        }
        q[k] = v;
        cambio(); programarPrevia();
        if (k === 'variables') pintarChips();
      });
    });
    ed.querySelectorAll('.herr button').forEach(b => b.onclick = () => {
      const ta = ed.querySelector('[data-k=enunciado]');
      const [antes, despues = ''] = b.dataset.ins.split('|');
      const i = ta.selectionStart, j = ta.selectionEnd, selTxt = ta.value.slice(i, j);
      ta.value = ta.value.slice(0, i) + antes + selTxt + despues + ta.value.slice(j);
      ta.focus(); ta.selectionStart = ta.selectionEnd = i + antes.length + selTxt.length;
      ta.dispatchEvent(new Event('input'));
    });
    ed.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      const a = b.dataset.b, P = banco.preguntas;
      if (a === 'duplicar') { const c = JSON.parse(JSON.stringify(q)); c.id = nuevoId(); c.nombre += ' (copia)'; P.splice(sel + 1, 0, c); sel++; }
      if (a === 'subir' && sel > 0) { [P[sel - 1], P[sel]] = [P[sel], P[sel - 1]]; sel--; }
      if (a === 'bajar' && sel < P.length - 1) { [P[sel + 1], P[sel]] = [P[sel], P[sel + 1]]; sel++; }
      if (a === 'eliminar') { if (!confirm(`¿Eliminar «${q.nombre}»?`)) return; P.splice(sel, 1); sel = Math.min(sel, P.length - 1); }
      renderTodo(); cambio();
    });
    pintarChips();
  }
  function pintarChips() {
    const cont = $('#chipsVars'), q = banco.preguntas[sel];
    if (!cont || !q) return;
    let nombres = [];
    try { nombres = Motor.parsearVariables(q.variables).map(d => d.n); } catch (e) { /* el error se muestra en la vista previa */ }
    cont.innerHTML = nombres.length ? '<small style="color:var(--suave)">Insertar:</small>' + nombres.map(n => `<button class="chip" data-v="${esc(n)}" style="border:0;cursor:pointer">{${esc(n)}}</button>`).join('') : '';
    cont.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      const ta = document.querySelector('[data-k=enunciado]'), t = `{${b.dataset.v}}`, i = ta.selectionStart;
      ta.value = ta.value.slice(0, i) + t + ta.value.slice(ta.selectionEnd);
      ta.focus(); ta.selectionStart = ta.selectionEnd = i + t.length;
      ta.dispatchEvent(new Event('input'));
    });
  }

  /* ---------- vista previa ---------- */
  let tPrevia = null;
  function programarPrevia() { clearTimeout(tPrevia); tPrevia = setTimeout(() => { renderPrevia(); renderLista(); }, 350); }
  function respuestaTexto(inst) {
    if (inst.tipo === 'numerica') return `${Motor.fmtNum(inst.valor)}${inst.unidad ? ' ' + esc(inst.unidad) : ''}${inst.tolerancia ? ` (± ${Motor.fmtNum(inst.tolerancia)})` : ''}`;
    if (inst.tipo === 'vf') return inst.verdadero ? 'Verdadero' : 'Falso';
    if (inst.tipo === 'corta') return inst.respuestas.map(esc).join(' · ');
    if (inst.tipo === 'opcion') return Motor.htmlLinea(inst.opciones.find(o => o.correcta).texto);
    return 'Calificación manual';
  }
  function renderPrevia() {
    const cont = $('#previa'), q = banco.preguntas[sel];
    if (!q) { cont.innerHTML = '<div style="color:var(--suave)">Selecciona o crea una pregunta para ver cómo la verá el estudiante.</div>'; $('#tablaVariantes').innerHTML = ''; return; }
    let inst;
    try {
      const rng = Motor.crearRng(semillaPrevia * 7919 + 13);
      for (let k = 0; k < 50; k++) { try { inst = Motor.instanciar(q, rng); break; } catch (e) { if (!e.repetidas) throw e; } }
      if (!inst) throw new Error('Las opciones salen repetidas: revisa los distractores.');
    } catch (e) { cont.innerHTML = `<div class="err">⚠ ${esc(e.message)}</div>`; $('#tablaVariantes').innerHTML = ''; return; }
    let h = `<div class="num">${esc(q.nombre || 'Pregunta')} · ${q.puntos} punto${q.puntos == 1 ? '' : 's'}</div><div>${Motor.aHtml(inst.enunciado)}</div>`;
    if (inst.tipo === 'opcion') {
      let ops = inst.opciones.slice();
      if (q.barajar !== false) { const r = Motor.crearRng(semillaPrevia); for (let i = ops.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ops[i], ops[j]] = [ops[j], ops[i]]; } }
      h += `<ul class="opc">${ops.map((o, i) => `<li class="${o.correcta ? 'bien' : ''}">${'abcdefghij'[i]}. ${Motor.htmlLinea(o.texto)}${o.correcta ? ' ✅' : ''}</li>`).join('')}</ul>`;
    } else if (inst.tipo === 'vf') h += `<ul class="opc"><li class="${inst.verdadero ? 'bien' : ''}">Verdadero${inst.verdadero ? ' ✅' : ''}</li><li class="${!inst.verdadero ? 'bien' : ''}">Falso${!inst.verdadero ? ' ✅' : ''}</li></ul>`;
    else if (inst.tipo === 'ensayo') h += `<div class="caja-resp">Espacio para la respuesta del estudiante…</div>`;
    else h += `<div class="caja-resp">Respuesta: ________ ${inst.tipo === 'numerica' && inst.unidad ? esc(inst.unidad) : ''}</div>`;
    if (inst.tipo !== 'opcion' && inst.tipo !== 'vf') h += `<div class="resp">✅ <b>Respuesta:</b> ${respuestaTexto(inst)}</div>`;
    if (inst.retro) h += `<div class="retro">💬 ${Motor.aHtml(inst.retro)}</div>`;
    const vs = Object.entries(inst.vars).filter(([k]) => !k.startsWith('__'));
    if (vs.length) h += `<div class="vars">Valores de esta variante: ${vs.map(([k, v]) => `<span class="chip">${esc(k)} = ${esc(Motor.fmtNum(v))}</span>`).join(' ')}</div>`;
    cont.innerHTML = h;
    matematicas(cont);
    if ($('#tablaVar').open) renderTablaVariantes();
  }
  function renderTablaVariantes() {
    const q = banco.preguntas[sel], cont = $('#tablaVariantes');
    if (!q) return;
    try {
      const todas = Motor.variantes(q, q.variantes || 1);
      const vs = todas.slice(0, 12);
      const nombres = Object.keys(vs[0].vars).filter(k => !k.startsWith('__'));
      cont.innerHTML = `<table class="var"><thead><tr><th>#</th>${nombres.map(n => `<th>${esc(n)}</th>`).join('')}<th>Respuesta</th></tr></thead><tbody>${vs.map((v, i) => `<tr><td>${i + 1}</td>${nombres.map(n => `<td>${esc(Motor.fmtNum(v.vars[n]))}</td>`).join('')}<td>${respuestaTexto(v)}</td></tr>`).join('')}</tbody></table>` +
        `<div class="ok">${todas.length < (q.variantes || 1) ? `⚠ Solo salen ${todas.length} variantes distintas con estos rangos (pediste ${q.variantes}). Amplía los rangos o pide menos.` : `✔ Se generan las ${q.variantes} variantes pedidas (se muestran ${vs.length}).`}</div>`;
      matematicas(cont);
    } catch (e) { cont.innerHTML = `<div class="err">⚠ ${esc(e.message)}</div>`; }
  }
  $('#tablaVar').addEventListener('toggle', () => { if ($('#tablaVar').open) renderTablaVariantes(); });
  $('#otra').onclick = () => { semillaPrevia++; renderPrevia(); };

  function renderTodo() { renderLista(); renderEditor(); renderPrevia(); }

  /* ---------- modal ---------- */
  function modal(titulo, html, botones) {
    $('#mTitulo').textContent = titulo;
    $('#mCuerpo').innerHTML = html;
    const pie = $('#mPie'); pie.innerHTML = '';
    botones.forEach(([t, fn, cls]) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = () => { if (fn() !== false) $('#modal').hidden = true; }; pie.appendChild(b); });
    $('#modal').hidden = false;
  }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-cerrar]')) $('#modal').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#modal').hidden = true; } });

  /* ---------- exportar a Moodle ---------- */
  function validarBanco() {
    if (!banco.preguntas.length) { toast('El banco no tiene preguntas.', true); return false; }
    const malas = banco.preguntas.map(q => ({ q, e: errorDe(q) })).filter(x => x.e);
    if (malas.length) { toast(`Corrige primero: «${malas[0].q.nombre}» — ${malas[0].e}`, true); sel = banco.preguntas.indexOf(malas[0].q); renderTodo(); return false; }
    return true;
  }
  function exportar() {
    if (!validarBanco()) return;
    let res;
    const generar = sub => Motor.exportarMoodleXML({ nombre: banco.nombre || 'Banco generado' }, banco.preguntas, { subcategorias: sub });
    try { res = generar(true); } catch (e) { toast(e.message, true); return; }
    const total = res.informe.reduce((s, r) => s + r.generadas, 0);
    modal('Exportar a Moodle (formato XML)', `
      <table class="inf"><thead><tr><th>Pregunta</th><th>Variantes</th><th>Categoría en Moodle</th></tr></thead><tbody>
      ${res.informe.map(r => `<tr><td>${esc(r.nombre)}</td><td>${r.generadas}${r.generadas < r.pedidas ? ` <span style="color:var(--rojo)" title="No hay más combinaciones distintas">de ${r.pedidas} ⚠</span>` : ''}</td><td style="font-size:12px">${esc(r.categoria)}</td></tr>`).join('')}
      </tbody></table>
      <p><b>${total}</b> preguntas en total.</p>
      <label class="chk"><input type="checkbox" id="optSub" checked> Una subcategoría por plantilla (recomendado para preguntas aleatorias)</label>
      <div class="nota"><b>En Moodle:</b> Banco de preguntas › <b>Importar</b> › formato <b>Moodle XML</b> › sube el archivo.<br>
      Luego, en el cuestionario: <b>Agregar › una pregunta aleatoria</b> y elige la subcategoría de cada plantilla. Así cada estudiante recibe una variante distinta. <a href="ayuda.html#moodle" target="_blank">Ver paso a paso</a>.</div>`,
    [['Cancelar', () => true], ['⬇ Descargar archivo XML', () => {
      try { res = generar($('#optSub').checked); } catch (e) { toast(e.message, true); return false; }
      descargar(res.xml, nombreArchivo(banco.nombre) + '_moodle.xml', 'application/xml');
      toast('Archivo descargado. Impórtalo en el banco de preguntas de Moodle.');
    }, 'prim']]);
  }

  /* ---------- examen impreso ---------- */
  function dialogoImpresion() {
    if (!validarBanco()) return;
    const hoy = new Date().toLocaleDateString('es-CO');
    modal('Examen impreso (papel o PDF)', `
      <div class="fila">
        <div class="campo"><label>Título</label><input id="iTit" value="${esc(banco.nombre || 'Evaluación')}"></div>
        <div class="campo"><label>Institución / curso</label><input id="iInst" placeholder="p. ej. Universidad — Cálculo"></div>
      </div>
      <div class="fila">
        <div class="campo"><label>Docente</label><input id="iDoc"></div>
        <div class="campo"><label>Fecha</label><input id="iFecha" value="${hoy}"></div>
        <div class="campo"><label>Número de versiones</label><input id="iVer" type="number" min="1" max="26" value="2"></div>
      </div>
      <div class="campo"><label>Instrucciones</label><textarea id="iInstr" rows="2">Lea cada pregunta con atención. Justifique sus respuestas cuando sea necesario.</textarea></div>
      <label class="chk"><input type="checkbox" id="iBarP"> Cambiar el orden de las preguntas en cada versión</label>
      <label class="chk"><input type="checkbox" id="iBarO" checked> Barajar las opciones de respuesta</label>
      <label class="chk"><input type="checkbox" id="iClave" checked> Incluir hoja con la clave de respuestas</label>
      <label class="chk"><input type="checkbox" id="iPts" checked> Mostrar el puntaje de cada pregunta</label>
      <div class="nota">Cada versión (A, B, C…) tiene valores distintos generados con las mismas plantillas. Se usa una variante por plantilla.</div>`,
    [['Cancelar', () => true], ['Generar examen', () => {
      const o = { titulo: $('#iTit').value, inst: $('#iInst').value, docente: $('#iDoc').value, fecha: $('#iFecha').value, versiones: Math.max(1, Math.min(26, parseInt($('#iVer').value) || 1)),
        instr: $('#iInstr').value, barP: $('#iBarP').checked, barO: $('#iBarO').checked, clave: $('#iClave').checked, pts: $('#iPts').checked };
      try { generarImpresion(o); } catch (e) { toast(e.message, true); return false; }
    }, 'prim']]);
  }
  function barajar(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function generarImpresion(o) {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const base = Date.now() % 100000;
    const hojas = [], claves = [];
    const totalPts = banco.preguntas.reduce((s, q) => s + (+q.puntos || 0), 0);
    for (let v = 0; v < o.versiones; v++) {
      const rng = Motor.crearRng(Motor.semillaDeTexto(`${banco.nombre}|${base}|${v}`));
      const orden = o.barP ? barajar(banco.preguntas, rng) : banco.preguntas.slice();
      const items = orden.map(q => {
        let inst;
        for (let k = 0; k < 60 && !inst; k++) { try { inst = Motor.instanciar(q, rng); } catch (e) { if (!e.repetidas) throw new Error(`«${q.nombre}»: ${e.message}`); } }
        if (!inst) throw new Error(`«${q.nombre}»: las opciones salen repetidas.`);
        if (inst.opciones) inst.opciones = (o.barO && q.barajar !== false) ? barajar(inst.opciones, rng) : inst.opciones;
        return { q, inst };
      });
      const ver = o.versiones > 1 ? letras[v] : '';
      let h = `<div class="hoja"><div class="enc">${ver ? `<span class="version">Versión ${ver}</span>` : ''}<h1>${esc(o.titulo)}</h1>
        <div class="meta"><span>${esc(o.inst)}</span><span>${o.docente ? 'Docente: ' + esc(o.docente) : ''}</span><span>${esc(o.fecha)}</span>${o.pts ? `<span>Total: ${Motor.fmtNum(totalPts)} puntos</span>` : ''}</div>
        <div class="datos"><div>Nombre:<span>&nbsp;</span></div><div>Código:<span>&nbsp;</span></div><div>Nota:<span>&nbsp;</span></div></div></div>
        ${o.instr ? `<p class="instr">${esc(o.instr)}</p>` : ''}`;
      const filasClave = [];
      items.forEach(({ q, inst }, i) => {
        h += `<div class="preg">${o.pts ? `<span class="pt">(${Motor.fmtNum(+q.puntos || 0)} pt${q.puntos == 1 ? '' : 's'})</span>` : ''}<b>${i + 1}.</b> ${Motor.aHtml(inst.enunciado).replace(/^<p>/, '<span>').replace(/<\/p>/, '</span>')}`;
        let clave;
        if (inst.tipo === 'opcion') {
          h += `<ol class="opc">${inst.opciones.map(op => `<li>${Motor.htmlLinea(op.texto)}</li>`).join('')}</ol>`;
          const k = inst.opciones.findIndex(op => op.correcta);
          clave = `<b>${'abcdefghij'[k]})</b> ${Motor.htmlLinea(inst.opciones[k].texto)}`;
        } else if (inst.tipo === 'vf') {
          h += `<div class="vfop">( &nbsp; ) Verdadero &nbsp;&nbsp;&nbsp; ( &nbsp; ) Falso</div>`;
          clave = inst.verdadero ? 'Verdadero' : 'Falso';
        } else if (inst.tipo === 'ensayo') {
          h += `<div class="espacio" style="height:55mm"></div>`;
          clave = inst.retro ? Motor.aHtml(inst.retro) : 'Respuesta abierta';
        } else {
          h += `<div style="margin-top:6px">Respuesta: <span class="linea" style="display:inline-block;width:45%;height:auto">&nbsp;</span> ${inst.tipo === 'numerica' ? esc(inst.unidad || '') : ''}</div>`;
          clave = respuestaTexto(inst);
        }
        h += '</div>';
        filasClave.push(`<tr><td>${i + 1}</td><td>${esc(q.nombre)}</td><td>${clave}</td></tr>`);
      });
      h += '</div>';
      hojas.push(h);
      claves.push(`<h3 style="font-family:system-ui,sans-serif;margin:14px 0 4px">${ver ? 'Versión ' + ver : 'Respuestas'}</h3><table class="clave"><thead><tr><th style="width:36px">N.º</th><th>Pregunta</th><th>Respuesta correcta</th></tr></thead><tbody>${filasClave.join('')}</tbody></table>`);
    }
    if (o.clave) hojas.push(`<div class="hoja"><div class="enc"><h1>Clave de respuestas — ${esc(o.titulo)}</h1><div class="meta"><span>${esc(o.inst)}</span><span>${esc(o.fecha)}</span></div></div>${claves.join('')}</div>`);
    $('#impHojas').innerHTML = hojas.join('');
    $('#impresion').hidden = false;
    matematicas($('#impHojas'));
    $('#impresion').scrollTop = 0;
  }
  $('#impImprimir').onclick = () => window.print();
  $('#impCerrar').onclick = () => { $('#impresion').hidden = true; };

  /* ---------- acciones ---------- */
  const acciones = {
    nuevo() {
      if (banco.preguntas.length && !confirm('¿Empezar un banco vacío? Guarda antes el actual si lo necesitas.')) return;
      cargarBanco({ nombre: '', preguntas: [] });
    },
    abrir() { $('#archivo').click(); },
    guardar() {
      if (!banco.preguntas.length) { toast('El banco está vacío.', true); return; }
      descargar(JSON.stringify({ app: 'GeneradorExamenes', version: 1, ...banco }, null, 2), nombreArchivo(banco.nombre) + '.json', 'application/json');
    },
    ejemplo() {
      if (banco.preguntas.length && !confirm('¿Reemplazar el banco actual por el de ejemplo?')) return;
      cargarBanco(JSON.parse(JSON.stringify(window.BANCO_EJEMPLO)));
      toast('Banco de ejemplo cargado: revisa cada pregunta y pulsa 🎲 para ver otras variantes.');
    },
    exportar, imprimir: dialogoImpresion
  };
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => acciones[b.dataset.a]());
  $('#archivo').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    f.text().then(t => { try { cargarBanco(JSON.parse(t)); toast(`Banco «${banco.nombre || f.name}» abierto.`); } catch (err) { toast('El archivo no es un banco válido.', true); } });
  });
  $('#nombreBanco').addEventListener('input', e => { banco.nombre = e.target.value; cambio(); });
  $('#btnNueva').onclick = e => { e.stopPropagation(); $('#menuNueva').hidden = !$('#menuNueva').hidden; };
  document.addEventListener('click', () => { $('#menuNueva').hidden = true; });
  document.querySelectorAll('#menuNueva [data-tipo]').forEach(b => b.onclick = () => { $('#menuNueva').hidden = true; agregar(b.dataset.tipo); });

  /* ---------- inicio ---------- */
  try { const s = localStorage.getItem(CLAVE); if (s) cargarBanco(JSON.parse(s)); else renderTodo(); }
  catch (e) { renderTodo(); }
})();
