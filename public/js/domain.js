export const MATERIALS = ['Papel', 'Cartón', 'Plástico', 'Vidrio', 'Metal', 'Aparatos electrónicos'];
export const ROLES = ['ciudadano', 'recolector'];
export const STATUS = { AVAILABLE: 'Disponible', ASSIGNED: 'En recolección', DONE: 'Recolectada', CANCELLED: 'Cancelada' };
const clean = value => String(value ?? '').trim();
function need(value, label, max = 180) {
  const text = clean(value);
  if (!text || text.length > max) throw new Error(`${label}: completa un valor de hasta ${max} caracteres.`);
  return text;
}
export function registration(input) {
  const name = need(input.name, 'Nombre', 80);
  const email = clean(input.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ingresa un correo válido.');
  if (String(input.password ?? '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (!ROLES.includes(input.role)) throw new Error('Selecciona ciudadano o recolector.');
  return { name, email, password: input.password, role: input.role };
}
export function pointInput(input) {
  const materials = [...new Set(input.materials ?? [])];
  if (!materials.length || materials.some(x => !MATERIALS.includes(x))) throw new Error('Selecciona al menos un material válido.');
  return { name: need(input.name, 'Nombre', 100), address: need(input.address, 'Dirección'),
    district: need(input.district, 'Distrito', 80), hours: need(input.hours, 'Horario', 180), materials };
}
export function publicationInput(input, now = new Date()) {
  if (!MATERIALS.includes(input.material)) throw new Error('Selecciona un material válido.');
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error('La cantidad debe ser mayor que cero y no superar 1 000 000.');
  if (!['kg', 'unidades'].includes(input.unit)) throw new Error('Selecciona una unidad válida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.availableDate)) throw new Error('Selecciona una fecha válida.');
  if (![input.timeStart, input.timeEnd].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('Ingresa horarios válidos.');
  if (input.timeStart >= input.timeEnd) throw new Error('La hora final debe ser posterior a la inicial.');
  const until = new Date(`${input.availableDate}T${input.timeEnd}:00`);
  if (!Number.isFinite(until.getTime()) || until <= now) throw new Error('La fecha y el horario disponibles ya pasaron.');
  return { material: input.material, quantity, unit: input.unit, district: need(input.district, 'Distrito', 80),
    address: need(input.address, 'Dirección'), availableDate: input.availableDate,
    timeStart: input.timeStart, timeEnd: input.timeEnd, availableUntil: until };
}
export function canEdit(pub, user) {
  return !!user && user.role === 'ciudadano' && pub.ownerId === user.uid && pub.status === STATUS.AVAILABLE;
}
export function canAccept(pub, user, now = new Date()) {
  const until = pub.availableUntil?.toDate ? pub.availableUntil.toDate() : new Date(pub.availableUntil);
  return !!user && user.role === 'recolector' && pub.status === STATUS.AVAILABLE && until > now;
}
export function canComplete(pub, user) {
  return !!user && user.role === 'recolector' && pub.collectorId === user.uid && pub.status === STATUS.ASSIGNED;
}
export function filterPoints(points, district = '', material = '') {
  const wanted = clean(district).toLocaleLowerCase('es');
  return points.filter(p => (!wanted || p.district.toLocaleLowerCase('es').includes(wanted)) && (!material || p.materials.includes(material)));
}
