// Núcleo compartido por los dashboards de Caja MyM: tipos de gasto, reglas,
// datos procesados y clasificaciones guardadas en el navegador (localStorage).
// Requiere datos-caja.js (CRUDO, EXTRAIDO).
// ---------- Tipos de gasto y reglas de clasificación ----------
let CATS = [
  ['adelanto', 'Préstamos y adelantos'],
  ['bono', 'Bonos y premios'],
  ['personal', 'Pagos y apoyos al personal'],
  ['combustible', 'Combustible'],
  ['envio', 'Envíos y recojo de mercadería'],
  ['uniforme', 'Uniformes y EPP'],
  ['herramienta', 'Herramientas, equipos y materiales'],
  ['vehiculo', 'Mantenimiento vehicular'],
  ['estacionamiento', 'Estacionamiento y peajes'],
  ['alimentacion', 'Alimentación'],
  ['evento', 'Eventos y capacitación'],
  ['seguro', 'Seguros SCTR'],
  ['viaje', 'Viajes y pasajes'],
  ['proveedor', 'Facturas de proveedores'],
  ['oficina', 'Oficina, trámites y otros'],
  ['lote', 'Paquetes sin desglose'],
  ['sinclasificar', 'Por clasificar'],
];
// Color fijo por tipo (sigue al tipo, no a su posición). Los 7 de mayor gasto tienen color; el resto va en «Otros».
const COLOR = { herramienta:'--s1', combustible:'--s2', proveedor:'--s3', adelanto:'--s4', lote:'--s5', vehiculo:'--s6', alimentacion:'--s7' };
const PILA = ['herramienta', 'combustible', 'proveedor', 'adelanto', 'lote', 'vehiculo', 'alimentacion', 'otros'];
const colorDe = k => 'var(' + (COLOR[k] || '--otros') + ')';
const grupoDe = k => COLOR[k] ? k : 'otros';

const REGLAS = [
  ['lote', d => /^(gastos|gastos varios|prestamos a personal y pagos)$/.test(d.base)],
  ['seguro', d => /sctr|seguro|mapfre/.test(d.txt)],
  ['proveedor', d => d.tipoCaja === 'Abono Proveedor' || /facturacion|facturas por/.test(d.base)],
  ['envio', d => /envio|encomienda|courier|recojo de mercader/.test(d.base)],
  ['combustible', d => /combustible|gasolina|\bglp\b|gasohol/.test(d.base)],
  ['uniforme', d => /uniforme|polos|pantalon|chaleco|zapato de seguridad|barbiquejo|fotocheck/.test(d.base)],
  ['bono', d => /\bbono|premio|tecnico del mes/.test(d.base)],
  ['estacionamiento', d => /estacionamiento|parqueo|cochera|peaje/.test(d.base)],
  ['vehiculo', d => /mantenimiento|cardan|freno|aceite|filtro|llanta|ploteo|lavado de auto|parril|chapas|\bmoto/.test(d.base)],
  ['herramienta', d => /cajuela|cajas metal|cajon de herr|\bups\b|adaptador|cargador|thinkpad|implementacion|alcohol isoprop|pilas|material|capacitor|detrac/.test(d.base)],
  ['alimentacion', d => /almuer|cena|desayuno|pizza|poller|alimento|comida|gaseosa|agua san|consumo en/.test(d.base)],
  ['evento', d => /cancha|diploma|capacitacion|futbol/.test(d.txt)],
  ['viaje', d => /pasaje|viaje/.test(d.base)],
  ['oficina', d => /lavanderia|notaria|legalizacion|fotocopia|medicamento|celular|rappi|hojas bond/.test(d.base)],
  ['adelanto', d => /adelanto|prestamo/.test(d.base)],
  ['personal', d => /apoyo|destajo|liquidacion|regularizacion|dia trabajado|pago juan/.test(d.base)],
];

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const NO_NOMBRE = new Set('transferencia yape plin adelanto adelantos prestamo envio materiales material pago apoyo para tecnico tecnicos almuerzo cena desayuno persona tercero destinatario cancelacion recibo seguro combustible'.split(' '));

const DATOS = CRUDO.trim().split(/\r?\n/).map(l => {
  const [numero, fechaOrig, monto, moneda, estado, tipoCaja, detalle, emisor] = l.split('|');
  const d = { id: numero, numero: 'CJ-' + numero, fechaOrig, fecha: fechaOrig, monto: +monto, moneda, estado, tipoCaja, detalle, emisor: emisor || '', alertas: [] };
  if (+fechaOrig.slice(0, 4) < 2026) {
    d.fecha = '2026' + fechaOrig.slice(4);
    d.alertas.push('Fecha corregida (decía ' + fechaOrig.split('-').reverse().join('/') + ')');
  }
  d.base = norm(detalle);
  d.txt = d.base + ' ' + norm(d.emisor);
  d.auto = (REGLAS.find(([, f]) => f(d)) || ['sinclasificar'])[0];
  // CAPEX: compras de activos que duran (equipos, implementación de cuadrillas, cajas metálicas, accesorios de vehículos).
  // Todo lo demás es gasto operativo (OPEX). Se puede cambiar por tipo o por gasto.
  d.claseAuto = (/implementacion|cajas metal|cajuela|cajon de herr|\bups\b|thinkpad|lenovo|parril|adaptadores usb|detrac/.test(d.base)) ? 'CAPEX' : 'OPEX';
  d.palabras = new Set(d.base.split(/[^a-z]+/).filter(w => w.length >= 4 && !NO_NOMBRE.has(w)));
  return d;
});
DATOS.forEach((a, i) => DATOS.forEach((b, j) => {
  if (j <= i || a.estado === 'Anulado' || b.estado === 'Anulado') return;
  if (a.fecha === b.fecha && a.monto === b.monto && a.moneda === b.moneda && [...a.palabras].some(w => b.palabras.has(w))) {
    a.alertas.push('¿Duplicado de ' + b.numero + '?');
    b.alertas.push('¿Duplicado de ' + a.numero + '?');
  }
}));
DATOS.forEach(d => { if (d.id === '2026-1014' || d.id === '2026-1016') d.alertas.push('Ojo: las cajas metálicas ya se cubrieron con CJ-0721 (adelanto 4000) + CJ-1030 (diferencia 4100); pagar esta factura sería doble'); });
DATOS.forEach(d => { if (d.auto === 'lote' || (d.monto >= 1000 && !d.emisor && d.auto !== 'combustible')) d.alertas.push('Monto grande sin desglose'); });

// ---------- Reclasificación manual (localStorage) ----------
const LS = 'mym_caja_clasif_v1', LS_CATS = 'mym_caja_cats_v1';
let manual = JSON.parse(localStorage.getItem(LS) || '{}');
const extra = JSON.parse(localStorage.getItem(LS_CATS) || '[]');
extra.forEach(c => { if (!CATS.some(x => x[0] === c[0])) CATS.splice(CATS.length - 1, 0, c); });
const catDe = d => manual[d.id] || d.auto;
// OPEX / CAPEX: el cambio por gasto gana al cambio por tipo, y este a la regla automática
const LS_CL = 'mym_caja_clase_v1', LS_CLT = 'mym_caja_clase_tipo_v1';
let claseManual = JSON.parse(localStorage.getItem(LS_CL) || '{}');
let claseTipo = JSON.parse(localStorage.getItem(LS_CLT) || '{}');
const claseDe = d => claseManual[d.id] || claseTipo[catDe(d)] || d.claseAuto;
const CLASES = ['OPEX', 'CAPEX', 'EXTERNO'];
// Imputable al gasto corriente operativo: casilla por gasto, marcada a mano (empieza sin marcar)
const LS_IMP = 'mym_caja_imputable_v1';
let imputable = JSON.parse(localStorage.getItem(LS_IMP) || '{}');
const esImp = d => !!imputable[d.id];
const guardarImp = () => localStorage.setItem(LS_IMP, JSON.stringify(imputable));
const nomClase = c => c === 'EXTERNO' ? 'Externo' : c;
const guardarClases = () => { localStorage.setItem(LS_CL, JSON.stringify(claseManual)); localStorage.setItem(LS_CLT, JSON.stringify(claseTipo)); };
const nomCat = k => k === 'otros' ? 'Otros tipos' : (CATS.find(c => c[0] === k) || [k, k])[1];

