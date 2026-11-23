/* Banco de ejemplo: muestra cada tipo de pregunta y las funciones más útiles */
window.BANCO_EJEMPLO = {
  nombre: 'Banco de ejemplo',
  preguntas: [
    {
      tipo: 'numerica', nombre: 'Derivada en un punto', categoria: 'Cálculo diferencial', puntos: 1, variantes: 20,
      enunciado: String.raw`Sea \( f(x) = {a}x^{3} {=coefs(b)}x^{2} {+c} \).

Calcule \( f'({x0}) \).`,
      variables: String.raw`a = randint(1, 5)
b = randnz(-6, 6)
c = randint(-9, 9)
x0 = randint(-3, 3)`,
      condicion: 'c != 0',
      respuesta: '3*a*x0^2 + 2*b*x0',
      tolerancia: '0', tolTipo: 'absoluta', unidad: '',
      retro: String.raw`\( f'(x) = {=3*a}x^{2} {=coefs(2*b)}x \), por lo que \( f'({x0}) = {=3*a*x0^2 + 2*b*x0} \).`
    },
    {
      tipo: 'numerica', nombre: 'Integral definida', categoria: 'Cálculo integral', puntos: 1, variantes: 20,
      enunciado: String.raw`Calcule \[ \int_{0}^{{k}} \left( {m}x + {n} \right)\,dx \]
Escriba la respuesta con dos decimales si no es entera.`,
      variables: String.raw`k = randint(1, 4)
m = randint(1, 6)
n = randint(1, 9)`,
      condicion: '',
      respuesta: 'm*k^2/2 + n*k',
      tolerancia: '0.01', tolTipo: 'absoluta', unidad: '',
      retro: String.raw`Una antiderivada es \( {=coef(m/2)}x^{2} + {=coef(n)}x \). Al evaluar entre 0 y {k} se obtiene {=m*k^2/2 + n*k}.`
    },
    {
      tipo: 'opcion', nombre: 'Ecuación lineal', categoria: 'Álgebra', puntos: 1, variantes: 20,
      enunciado: String.raw`Resuelva la ecuación \( {a}x {+b} = {c} \).`,
      variables: String.raw`a = randint(2, 9)
r = randnz(-8, 8)       # solución entera
b = randnz(-15, 15)
c = a*r + b`,
      condicion: '',
      correcta: String.raw`\( x = {r} \)`,
      distractores: String.raw`\( x = {=-r} \)
\( x = {=(c+b)/a:2} \)
\( x = {=r+1} \)`,
      barajar: true, restaIncorrecta: false,
      retro: String.raw`Despejamos el término con x: \( {a}x = {c} {=+(-b)} = {=c-b} \). Luego dividimos entre {a}: \( x = {r} \).`
    },
    {
      tipo: 'numerica', nombre: 'Descuento porcentual', categoria: 'Razonamiento cuantitativo', puntos: 1, variantes: 25,
      enunciado: String.raw`{nombre} compra un artículo que cuesta {=miles(precio*1000)} pesos y tiene un descuento del {d} %.

¿Cuántos pesos paga {nombre}?`,
      variables: String.raw`nombre = choice("Ana", "Luis", "Camila", "Andrés", "Valentina", "Juan")
precio = randint(40, 180)   # en miles de pesos
d = choice(5, 10, 15, 20, 25, 30)`,
      condicion: '',
      respuesta: 'precio*1000*(1 - d/100)',
      tolerancia: '1', tolTipo: 'absoluta', unidad: 'pesos',
      retro: 'Paga el {=100-d} % del precio: {=miles(precio*1000)} × {=(100-d)/100} = {=miles(precio*1000*(1-d/100))} pesos.'
    },
    {
      tipo: 'opcion', nombre: 'Regla de tres', categoria: 'Razonamiento cuantitativo', puntos: 1, variantes: 20,
      enunciado: 'Si {t1} trabajadores construyen un muro en {d1} días, ¿cuántos días tardarán {t2} trabajadores, al mismo ritmo?',
      variables: String.raw`t1 = randint(2, 8)
t2 = randint(2, 12)
d1 = randint(3, 15)
d2 = t1*d1/t2`,
      condicion: 't1 != t2 and t1*d1 % t2 == 0',
      correcta: '{d2} días',
      distractores: String.raw`{=d1*t2/t1:1} días
{=d1+t2-t1} días
{=t1*d1} días`,
      barajar: true, restaIncorrecta: false,
      retro: 'Es una proporción inversa: más trabajadores, menos días. {t1} × {d1} = {t2} × x, de donde x = {d2}.'
    },
    {
      tipo: 'vf', nombre: 'Monotonía de una recta', categoria: 'Álgebra', puntos: 1, variantes: 10,
      enunciado: String.raw`La función \( f(x) = {=coef(m)}x {+b} \) es creciente.`,
      variables: String.raw`m = randnz(-5, 5)
b = randint(-6, 6)`,
      condicion: '',
      condicionVF: 'm > 0',
      retro: 'Una recta es creciente si su pendiente es positiva. Aquí la pendiente es {m}.'
    },
    {
      tipo: 'corta', nombre: 'Nombre del teorema', categoria: 'Cálculo integral', puntos: 1, variantes: 1,
      enunciado: 'El teorema que relaciona la derivada y la integral se llama teorema ______ del cálculo.',
      variables: '', condicion: '',
      aceptadas: 'fundamental\nFundamental\nteorema fundamental',
      mayusculas: false,
      retro: 'Es el teorema fundamental del cálculo.'
    },
    {
      tipo: 'ensayo', nombre: 'Explicar el concepto de límite', categoria: 'Cálculo diferencial', puntos: 2, variantes: 1,
      enunciado: 'Explique con sus palabras qué significa \\( \\lim_{x \\to a} f(x) = L \\) y dé un ejemplo.',
      variables: '', condicion: '', adjuntos: false,
      retro: 'Debe mencionar que f(x) se acerca a L cuando x se acerca a a (sin que importe el valor f(a)), y un ejemplo correcto.'
    }
  ]
};
