// Тест логики авто заказов
console.log('🧪 Тест логики авто заказов\n');

// Симуляция функции has30DaysPassed
function has30DaysPassed(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 30;
}

// Тестовые клиенты
const today = new Date();
const clients = [
  {
    id: '1',
    name: 'Новый клиент',
    createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 день назад
    lastAutoOrderCheck: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    autoOrdersEnabled: true
  },
  {
    id: '2', 
    name: 'Клиент 29 дней',
    createdAt: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString(), // 29 дней назад
    lastAutoOrderCheck: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    autoOrdersEnabled: true
  },
  {
    id: '3',
    name: 'Клиент 30 дней',
    createdAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 дней назад
    lastAutoOrderCheck: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    autoOrdersEnabled: true
  },
  {
    id: '4',
    name: 'Клиент 45 дней',
    createdAt: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 дней назад
    lastAutoOrderCheck: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 дней назад
    isActive: true,
    autoOrdersEnabled: true
  }
];

console.log('📅 Сегодня:', today.toDateString());
console.log('');

clients.forEach(client => {
  const daysSinceCreation = has30DaysPassed(client.createdAt);
  const daysSinceLastCheck = has30DaysPassed(client.lastAutoOrderCheck || client.createdAt);
  const isEligible = daysSinceCreation || daysSinceLastCheck;
  
  const created = new Date(client.createdAt);
  const lastCheck = new Date(client.lastAutoOrderCheck);
  const daysSinceCreationNum = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceLastCheckNum = Math.floor((today.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log(`👤 ${client.name}:`);
  console.log(`   Дней с создания: ${daysSinceCreationNum} (${daysSinceCreation ? '✅' : '❌'})`);
  console.log(`   Дней с последней проверки: ${daysSinceLastCheckNum} (${daysSinceLastCheck ? '✅' : '❌'})`);
  console.log(`   Доступен для авто заказов: ${isEligible ? '✅ ДА' : '❌ НЕТ'}`);
  console.log('');
});

console.log('🎯 Ожидаемое поведение:');
console.log('• Новый клиент: НЕ доступен (меньше 30 дней)');
console.log('• Клиент 29 дней: НЕ доступен (меньше 30 дней)');
console.log('• Клиент 30 дней: ДОСТУПЕН (ровно 30 дней)');
console.log('• Клиент 45 дней: ДОСТУПЕН (последняя проверка 15 дней назад, но создание 45 дней назад)');