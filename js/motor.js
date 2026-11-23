/* =========================================================
   Generador de exámenes — Motor
   - Evaluador seguro de expresiones (sin eval)
   - Variables aleatorias con semilla reproducible
   - Sustitución de plantillas {a}, {=expr}, {=expr:2}, {+a}
   - Generación de variantes y exportación a Moodle XML
   ========================================================= */
(function (root) {
  'use strict';

  /* ---------- Generador pseudoaleatorio con semilla (mulberry32) ---------- */
  function crearRng(semilla) {
    let s = semilla >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function semillaDeTexto(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- Analizador léxico ---------- */
  function tokenizar(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(src.slice(i));
        if (!m) throw new Error(`Número mal escrito cerca de «${src.slice(i, i + 6)}»`);
        toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (c === '"' || c === "'") {
        const j = src.indexOf(c, i + 1);
        if (j < 0) throw new Error('Falta cerrar las comillas de un texto');
        toks.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue;
      }
      if (/[\p{L}_]/u.test(c)) {
        const m = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
        const w = m[0];
        const low = w.toLowerCase();
        if (low === 'and') toks.push({ t: 'op', v: '&&' });
        else if (low === 'or') toks.push({ t: 'op', v: '||' });
        else if (low === 'not') toks.push({ t: 'op', v: '!' });
        else toks.push({ t: 'id', v: w });
        i += w.length; continue;
      }
      const dos = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '<>', '**'].includes(dos)) {
        toks.push({ t: 'op', v: dos === '<>' ? '!=' : dos === '**' ? '^' : dos }); i += 2; continue;
      }
      if ('+-*/^%(),<>!='.includes(c)) { toks.push({ t: 'op', v: c === '=' ? '==' : c }); i++; continue; }
      throw new Error(`Carácter no permitido: «${c}»`);
    }
    return toks;
  }

  /* ---------- Analizador sintáctico (descenso recursivo) → árbol ---------- */
  function analizar(src) {
    const toks = tokenizar(src);
    let p = 0;
    const ver = () => toks[p];
    const es = v => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    const tomar = v => { if (!es(v)) throw new Error(`Se esperaba «${v}»${toks[p] ? ' cerca de «' + (toks[p].v) + '»' : ' al final'}`); p++; };
    function expr() { return o(); }
    function o() { let a = y(); while (es('||')) { p++; a = { k: 'bin', op: '||', a, b: y() }; } return a; }
    function y() { let a = cmp(); while (es('&&')) { p++; a = { k: 'bin', op: '&&', a, b: cmp() }; } return a; }
    function cmp() {
      let a = suma();
      for (const op of ['==', '!=', '<=', '>=', '<', '>']) if (es(op)) { p++; return { k: 'bin', op, a, b: suma() }; }
      return a;
    }
    function suma() { let a = mult(); while (es('+') || es('-')) { const op = ver().v; p++; a = { k: 'bin', op, a, b: mult() }; } return a; }
    function mult() { let a = unario(); while (es('*') || es('/') || es('%')) { const op = ver().v; p++; a = { k: 'bin', op, a, b: unario() }; } return a; }
    function unario() {
      if (es('-')) { p++; return { k: 'neg', a: unario() }; }
      if (es('+')) { p++; return unario(); }
      if (es('!')) { p++; return { k: 'not', a: unario() }; }
      return pot();
    }
    function pot() { const a = prim(); if (es('^')) { p++; return { k: 'bin', op: '^', a, b: unario() }; } return a; }
    function prim() {
      const t = ver();
      if (!t) throw new Error('La expresión está incompleta');
      if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
      if (t.t === 'str') { p++; return { k: 'str', v: t.v }; }
      if (t.t === 'id') {
        p++;
        if (es('(')) {
          p++;
          const args = [];
          if (!es(')')) { args.push(expr()); while (es(',')) { p++; args.push(expr()); } }
          tomar(')');
          return { k: 'fn', n: t.v.toLowerCase(), args };
        }
        return { k: 'var', n: t.v };
      }
      if (es('(')) { p++; const a = expr(); tomar(')'); return a; }
      throw new Error(`Símbolo inesperado «${t.v}»`);
    }
    const arbol = expr();
    if (p < toks.length) throw new Error(`Sobra «${toks[p].v}» en la expresión`);
    return arbol;
  }

  /* ---------- Funciones disponibles ---------- */
  const gcd = (a, b) => { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) [a, b] = [b, a % b]; return a; };
  function funciones(rng) {
    const num = (x, n) => { if (typeof x !== 'number' || isNaN(x)) throw new Error(`${n} necesita números`); return x; };
    return {
      // aleatorias
      randint: (a, b) => { a = Math.ceil(num(a, 'randint')); b = Math.floor(num(b, 'randint')); if (b < a) throw new Error('randint(a, b) necesita a ≤ b'); return a + Math.floor(rng() * (b - a + 1)); },
      randreal: (a, b, d = 2) => { const x = a + rng() * (b - a); return Math.round(x * 10 ** d) / 10 ** d; },
      randstep: (a, b, s) => { const n = Math.floor((b - a) / s + 1e-9); return +(a + s * Math.floor(rng() * (n + 1))).toFixed(10); },
      randnz: (a, b) => { const op = []; for (let i = Math.ceil(a); i <= Math.floor(b); i++) if (i !== 0) op.push(i); if (!op.length) throw new Error('randnz sin valores'); return op[Math.floor(rng() * op.length)]; },
      choice: (...xs) => { if (!xs.length) throw new Error('choice() necesita opciones'); return xs[Math.floor(rng() * xs.length)]; },
      // matemáticas
      abs: Math.abs, sqrt: Math.sqrt, cbrt: Math.cbrt, exp: Math.exp, ln: Math.log, log10: Math.log10,
      log: (x, b) => b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b),
      sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
      sind: x => Math.sin(x * Math.PI / 180), cosd: x => Math.cos(x * Math.PI / 180), tand: x => Math.tan(x * Math.PI / 180),
      floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc, sign: Math.sign,
      round: (x, d = 0) => { const f = 10 ** d; return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f; },
      min: Math.min, max: Math.max, pow: Math.pow,
      gcd, mcd: gcd, lcm: (a, b) => Math.abs(a * b) / gcd(a, b), mcm: (a, b) => Math.abs(a * b) / gcd(a, b),
      fact: n => { n = Math.round(n); if (n < 0 || n > 170) throw new Error('fact fuera de rango'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
      comb: (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); },
      perm: (n, k) => { let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; },
      pi: () => Math.PI, e: () => Math.E,
      // utilidades de texto
      si: (c, a, b) => (c ? a : b), if: (c, a, b) => (c ? a : b),
      // coeficientes para escribir polinomios: coef(1) → "", coef(-1) → "-", coef(3) → "3"
      coef: c => (c === 1 ? '' : c === -1 ? '-' : fmtNum(c)),
      // con signo: coefs(1) → "+ ", coefs(-1) → "- ", coefs(-3) → "- 3"
      coefs: c => (c < 0 ? '- ' : '+ ') + (Math.abs(c) === 1 ? '' : fmtNum(Math.abs(c))),
      // separador de miles para dinero: miles(160000) → "160.000"
      miles: x => { const s = String(Math.round(x)); return s.replace(/\B(?=(\d{3})+(?!\d))/g, Motor.decimalComa ? '.' : ','); },
      frac: (a, b) => { const g = gcd(a, b) || 1; let n = a / g, d = b / g; if (d < 0) { n = -n; d = -d; } return d === 1 ? String(n) : `${n}/${d}`; }
    };
  }
  const CONSTANTES = { pi: Math.PI, e: Math.E };

  function evaluar(arbol, vars, F) {
    switch (arbol.k) {
      case 'num': case 'str': return arbol.v;
      case 'var':
        if (Object.prototype.hasOwnProperty.call(vars, arbol.n)) return vars[arbol.n];
        if (CONSTANTES[arbol.n.toLowerCase()] !== undefined) return CONSTANTES[arbol.n.toLowerCase()];
        throw new Error(`La variable «${arbol.n}» no está definida`);
      case 'neg': return -evaluar(arbol.a, vars, F);
      case 'not': return !evaluar(arbol.a, vars, F);
      case 'fn': {
        const f = F[arbol.n];
        if (!f) throw new Error(`Función desconocida: ${arbol.n}()`);
        return f(...arbol.args.map(a => evaluar(a, vars, F)));
      }
      case 'bin': {
        if (arbol.op === '&&') return evaluar(arbol.a, vars, F) && evaluar(arbol.b, vars, F);
        if (arbol.op === '||') return evaluar(arbol.a, vars, F) || evaluar(arbol.b, vars, F);
        const a = evaluar(arbol.a, vars, F), b = evaluar(arbol.b, vars, F);
        switch (arbol.op) {
          case '+': return (typeof a === 'string' || typeof b === 'string') ? String(a) + String(b) : a + b;
          case '-': return a - b; case '*': return a * b; case '/': return a / b;
          case '%': return ((a % b) + b) % b; case '^': return Math.pow(a, b);
          case '==': return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
          case '!=': return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) >= 1e-9 : a !== b;
          case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
        }
      }
    }
    throw new Error('Expresión no válida');
  }

  const cache = new Map();
  function compilar(src) {
    if (!cache.has(src)) cache.set(src, analizar(src));
    return cache.get(src);
  }
  function calc(src, vars, rng) { return evaluar(compilar(src), vars, funciones(rng || Math.random)); }

  /* ---------- Formato de números ---------- */
  const Motor = { decimalComa: true };
  function fmtNum(v, dec) {
    if (typeof v === 'boolean') return v ? 'Verdadero' : 'Falso';
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return isNaN(v) ? 'indefinido' : (v > 0 ? '∞' : '−∞');
    let s;
    if (dec !== undefined && dec !== null) s = v.toFixed(dec);
    else if (Number.isInteger(v)) s = String(v);
    else s = String(parseFloat(v.toPrecision(10)));
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    if (s.includes('e')) s = String(+v.toPrecision(6));
    return Motor.decimalComa ? s.replace('.', ',') : s;
  }
  /* Número para Moodle (siempre con punto) */
  function numMoodle(v) { return Number.isInteger(v) ? String(v) : String(parseFloat(v.toPrecision(12))); }

  /* ---------- Variables ---------- */
  /* Líneas «nombre = expresión»; # inicia un comentario */
  function parsearVariables(txt) {
    const defs = [];
    (txt || '').split('\n').forEach((l, i) => {
      const s = l.replace(/#.*$/, '').trim();
      if (!s) return;
      const m = /^([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)\s*(.+)$/u.exec(s);
      if (!m) throw new Error(`Línea ${i + 1} de variables no válida: «${s}». Usa el formato  nombre = expresión`);
      compilar(m[2]);
      defs.push({ n: m[1], e: m[2], linea: i + 1 });
    });
    return defs;
  }
  function generarValores(defs, condicion, rng, maxIntentos = 500) {
    const F = funciones(rng);
    const cond = condicion && condicion.trim() ? compilar(condicion.trim()) : null;
    for (let k = 0; k < maxIntentos; k++) {
      const vars = {};
      for (const d of defs) {
        try { vars[d.n] = evaluar(compilar(d.e), vars, F); }
        catch (e) { throw new Error(`Variable «${d.n}» (línea ${d.linea}): ${e.message}`); }
        if (typeof vars[d.n] === 'number' && !isFinite(vars[d.n])) { vars.__malo = true; break; }
      }
      if (vars.__malo) continue;
      if (!cond || evaluar(cond, vars, F)) return vars;
    }
    throw new Error('No se encontraron valores que cumplan la condición tras 500 intentos. Revisa la condición o los rangos.');
  }

  /* ---------- Plantillas de texto ---------- */
  /* {a} → valor de a (si a es variable); {=expr} o {=expr:2} → valor calculado (con 2 decimales);
     {+a} o {=+expr} → con signo explícito: «+ 3» o «− 3» (útil en polinomios) */
  /* Rangos del texto que están dentro de fórmulas LaTeX: \( \), \[ \], $$ $$ */
  function rangosMath(txt) {
    const r = [], re = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
    let m;
    while ((m = re.exec(txt))) r.push([m.index, m.index + m[0].length]);
    return r;
  }
  function rellenar(txt, vars, rng) {
    if (!txt) return '';
    const F = funciones(rng || Math.random);
    const mates = rangosMath(txt);
    const enMath = pos => mates.some(([a, b]) => pos > a && pos < b);
    return txt.replace(/\{(\+?)(=)?\s*([^{}]+?)\s*\}/g, (todo, signo, igual, cuerpo, pos) => {
      // dentro de una fórmula la coma decimal va entre llaves para que LaTeX no agregue espacio: 1{,}5
      const fmt = (v, d) => { const s = fmtNum(v, d); return enMath(pos) ? s.replace(/(\d),(\d)/g, '$1{,}$2') : s; };
      let expr = cuerpo, dec;
      if (!igual) {
        if (!Object.prototype.hasOwnProperty.call(vars, cuerpo.trim())) return todo; // p. ej. \frac{1}{2} en LaTeX
        expr = cuerpo.trim();
      } else {
        if (cuerpo.startsWith('+')) { signo = '+'; cuerpo = cuerpo.slice(1); }
        const m = /^(.*?):(\d+)$/s.exec(cuerpo);
        if (m) { expr = m[1]; dec = +m[2]; }
      }
      let v;
      try { v = evaluar(compilar(expr), vars, F); }
      catch (e) { throw new Error(`En «${todo}»: ${e.message}`); }
      if (signo && typeof v === 'number') return (v < 0 ? '- ' : '+ ') + fmt(Math.abs(v), dec);
      return fmt(v, dec);
    });
  }

  /* ---------- Variantes ---------- */
  /* Devuelve una instancia concreta de la pregunta */
  function instanciar(q, rng) {
    const defs = parsearVariables(q.variables);
    const vars = generarValores(defs, q.condicion, rng);
    const R = t => rellenar(t, vars, rng);
    const inst = { tipo: q.tipo, nombre: q.nombre, enunciado: R(q.enunciado), retro: R(q.retro), vars };
    if (q.tipo === 'numerica') {
      const F = funciones(rng);
      const v = evaluar(compilar(q.respuesta || '0'), vars, F);
      if (typeof v !== 'number' || !isFinite(v)) throw new Error('La respuesta numérica no da un número válido');
      inst.valor = v + 0; // evita «-0»
      let tol = q.tolerancia ? evaluar(compilar(String(q.tolerancia)), vars, F) : 0;
      if (q.tolTipo === 'relativa') tol = Math.abs(v) * tol / 100;
      inst.tolerancia = Math.abs(tol);
      inst.unidad = q.unidad || '';
    } else if (q.tipo === 'opcion') {
      const correcta = R(q.correcta);
      const distr = (q.distractores || '').split('\n').map(s => s.trim()).filter(Boolean).map(R);
      const todas = [correcta].concat(distr);
      const norm = s => s.replace(/\s+/g, ' ').trim();
      if (new Set(todas.map(norm)).size !== todas.length) { const e = new Error('opciones repetidas'); e.repetidas = true; throw e; }
      inst.opciones = todas.map((t, i) => ({ texto: t, correcta: i === 0 }));
    } else if (q.tipo === 'vf') {
      const F = funciones(rng);
      inst.verdadero = !!evaluar(compilar(q.condicionVF || 'true'), Object.assign({ true: true, false: false, verdadero: true, falso: false }, vars), F);
    } else if (q.tipo === 'corta') {
      inst.respuestas = (q.aceptadas || '').split('\n').map(s => s.trim()).filter(Boolean).map(R);
      if (!inst.respuestas.length) throw new Error('Escribe al menos una respuesta aceptada');
      inst.mayusculas = !!q.mayusculas;
    }
    return inst;
  }
  /* Genera n variantes distintas (por enunciado y respuesta) */
  function variantes(q, n, semilla) {
    const rng = crearRng(semilla ?? semillaDeTexto((q.id || '') + (q.enunciado || '') + (q.variables || '')));
    const out = [], vistas = new Set();
    let repetidas = 0;
    for (let k = 0; k < n * 40 && out.length < n; k++) {
      let inst;
      try { inst = instanciar(q, rng); }
      catch (e) { if (e.repetidas) { repetidas++; continue; } throw e; }
      const clave = inst.enunciado + '|' + (inst.valor ?? '') + (inst.opciones ? inst.opciones.map(o => o.texto).join('|') : '') + (inst.verdadero ?? '');
      if (vistas.has(clave)) continue;
      vistas.add(clave); out.push(inst);
      if (!(q.variables || '').trim()) break; // sin variables solo hay una versión
    }
    if (!out.length && repetidas) throw new Error('Las opciones de respuesta salen repetidas en todas las variantes. Revisa los distractores.');
    return out;
  }

  /* ---------- Moodle XML ---------- */
  const cdata = s => `<![CDATA[${String(s ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
  const escXml = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  /* Convierte saltos de línea en párrafos HTML y deja el LaTeX \( \) tal cual (Moodle lo procesa con MathJax) */
  function aHtml(txt) {
    if (/<(p|div|br|table|img|ul|ol)\b/i.test(txt)) return txt;
    return txt.split(/\n{2,}/).map(par => `<p>${escHtml(par).replace(/\n/g, '<br>')}</p>`).join('');
  }
  /* Texto de una línea a HTML: se escapan <, > y & salvo que ya traiga etiquetas */
  function htmlLinea(t) { return /<[a-z][^>]*>/i.test(t) ? t : escHtml(t); }
  function escHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  function xmlPregunta(inst, q, nombre) {
    const pen = q.penalizacion ?? 0.3333333;
    const cab = (tipo) => `  <question type="${tipo}">
    <name><text>${escXml(nombre)}</text></name>
    <questiontext format="html"><text>${cdata(aHtml(inst.enunciado))}</text></questiontext>
    <generalfeedback format="html"><text>${cdata(inst.retro ? aHtml(inst.retro) : '')}</text></generalfeedback>
    <defaultgrade>${+(q.puntos ?? 1)}</defaultgrade>
    <penalty>${pen}</penalty>
    <hidden>0</hidden>
`;
    if (inst.tipo === 'numerica') {
      return cab('numerical') + `    <answer fraction="100" format="moodle_auto_format">
      <text>${numMoodle(inst.valor)}</text>
      <feedback format="html"><text></text></feedback>
      <tolerance>${numMoodle(inst.tolerancia)}</tolerance>
    </answer>
    <unitgradingtype>0</unitgradingtype>
    <unitpenalty>0.1000000</unitpenalty>
    <showunits>3</showunits>
    <unitsleft>0</unitsleft>
  </question>
`;
    }
    if (inst.tipo === 'opcion') {
      const negativo = q.restaIncorrecta ? -Math.round(100 / Math.max(1, inst.opciones.length - 1) * 100000) / 100000 : 0;
      return cab('multichoice') + `    <single>true</single>
    <shuffleanswers>${q.barajar === false ? 'false' : 'true'}</shuffleanswers>
    <answernumbering>abc</answernumbering>
    <showstandardinstruction>0</showstandardinstruction>
    <correctfeedback format="html"><text>Respuesta correcta.</text></correctfeedback>
    <partiallycorrectfeedback format="html"><text></text></partiallycorrectfeedback>
    <incorrectfeedback format="html"><text>Respuesta incorrecta.</text></incorrectfeedback>
` + inst.opciones.map(o => `    <answer fraction="${o.correcta ? 100 : negativo}" format="html">
      <text>${cdata(htmlLinea(o.texto))}</text>
      <feedback format="html"><text></text></feedback>
    </answer>
`).join('') + `  </question>
`;
    }
    if (inst.tipo === 'vf') {
      return cab('truefalse') + `    <answer fraction="${inst.verdadero ? 100 : 0}" format="moodle_auto_format">
      <text>true</text>
      <feedback format="html"><text></text></feedback>
    </answer>
    <answer fraction="${inst.verdadero ? 0 : 100}" format="moodle_auto_format">
      <text>false</text>
      <feedback format="html"><text></text></feedback>
    </answer>
  </question>
`;
    }
    if (inst.tipo === 'corta') {
      return cab('shortanswer') + `    <usecase>${inst.mayusculas ? 1 : 0}</usecase>
` + inst.respuestas.map(r => `    <answer fraction="100" format="moodle_auto_format">
      <text>${escXml(r)}</text>
      <feedback format="html"><text></text></feedback>
    </answer>
`).join('') + `  </question>
`;
    }
    if (inst.tipo === 'ensayo') {
      return cab('essay') + `    <responseformat>editor</responseformat>
    <responserequired>1</responserequired>
    <responsefieldlines>15</responsefieldlines>
    <attachments>${q.adjuntos ? 1 : 0}</attachments>
    <attachmentsrequired>0</attachmentsrequired>
    <graderinfo format="html"><text>${cdata(inst.retro ? aHtml(inst.retro) : '')}</text></graderinfo>
    <responsetemplate format="html"><text></text></responsetemplate>
  </question>
`;
    }
    throw new Error('Tipo de pregunta desconocido');
  }

  /* banco: {nombre, preguntas:[...]} ; opciones: {subcategorias:true} */
  function exportarMoodleXML(banco, preguntas, opciones = {}) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n';
    const informe = [];
    const raiz = (banco.nombre || 'Banco generado').replace(/\//g, '-');
    preguntas.forEach(q => {
      const cat = [raiz, (q.categoria || 'General').replace(/\//g, '-')];
      if (opciones.subcategorias !== false) cat.push((q.nombre || 'Pregunta').replace(/\//g, '-'));
      xml += `  <question type="category">
    <category><text>$course$/top/${escXml(cat.join('/'))}</text></category>
    <info format="html"><text></text></info>
  </question>
`;
      const n = Math.max(1, Math.min(200, q.variantes || 1));
      const vs = variantes(q, n);
      const ancho = String(vs.length).length;
      vs.forEach((inst, i) => {
        const nombre = vs.length > 1 ? `${q.nombre || 'Pregunta'} — v${String(i + 1).padStart(Math.max(2, ancho), '0')}` : (q.nombre || 'Pregunta');
        xml += xmlPregunta(inst, q, nombre);
      });
      informe.push({ nombre: q.nombre, pedidas: n, generadas: vs.length, categoria: cat.join(' / ') });
    });
    xml += '</quiz>\n';
    return { xml, informe };
  }

  Object.assign(Motor, { crearRng, semillaDeTexto, analizar, compilar, calc, evaluar, funciones, fmtNum, parsearVariables, generarValores, rellenar, instanciar, variantes, exportarMoodleXML, aHtml, escHtml, htmlLinea });
  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
  else root.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);
