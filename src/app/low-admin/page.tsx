'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  BarChart3, 
  Package, 
  History, 
  User, 
  LogOut,
  Plus,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface Order {
  id: string
  orderNumber: number
  customer: {
    name: string
    phone: string
  }
  deliveryAddress: string
  deliveryTime: string
  quantity: number
  calories: number
  specialFeatures: string
  paymentStatus: string
  paymentMethod: string
  orderStatus: string
  isPrepaid: boolean
  createdAt: string
}

interface Stats {
  successfulOrders: number
  failedOrders: number
  prepaidOrders: number
  unpaidOrders: number
  cardOrders: number
  cashOrders: number
  dailyCustomers: number
  evenDayCustomers: number
  oddDayCustomers: number
  specialPreferenceCustomers: number
  orders1200: number
  orders1600: number
  orders2000: number
  orders2500: number
  orders3000: number
  singleItemOrders: number
  multiItemOrders: number
}

export default function LowAdminPage() {
  const [activeTab, setActiveTab] = useState('statistics')
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    successful: true,
    failed: false,
    prepaid: false,
    unpaid: false,
    card: false,
    cash: false,
    daily: false,
    evenDay: false,
    oddDay: false,
    special: false,
    calories1200: false,
    calories1600: false,
    calories2000: false,
    calories2500: false,
    calories3000: false,
    singleItem: false,
    multiItem: false
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    
    if (!token || user.role !== 'LOW_ADMIN') {
      window.location.href = '/'
      return
    }

    fetchData()
  }, [selectedDate, filters])

  const fetchData = async () => {
    try {
      // Fetch orders
      const ordersResponse = await fetch(`/api/orders?date=${selectedDate.toISOString()}&filters=${JSON.stringify(filters)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrders(ordersData)
      }

      // Fetch stats
      const statsResponse = await fetch('/api/admin/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/'
  }

  const getDateRange = () => {
    const dates = []
    const today = new Date(selectedDate)
    
    for (let i = -4; i <= 5; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date)
    }
    
    return dates
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-green-500'
      case 'IN_DELIVERY': return 'bg-yellow-500'
      case 'FAILED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'Доставлен'
      case 'IN_DELIVERY': return 'В доставке'
      case 'FAILED': return 'Не доставлен'
      default: return 'Ожидает'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-slate-900">Панель Низкого Администратора</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <User className="w-4 h-4 mr-2" />
                Профиль
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="statistics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Заказы
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              История
            </TabsTrigger>
          </TabsList>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stats && (
                <>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, successful: true, failed: false})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Успешные заказы
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.successfulOrders}</div>
                      <p className="text-xs text-slate-500">Выполнено</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, successful: false, failed: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        Неуспешные заказы
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.failedOrders}</div>
                      <p className="text-xs text-slate-500">Отменено</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, prepaid: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Предоплаченные</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.prepaidOrders}</div>
                      <p className="text-xs text-slate-500">Оплачено заранее</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, unpaid: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Неоплаченные</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.unpaidOrders}</div>
                      <p className="text-xs text-slate-500">Оплата при получении</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, card: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Оплата картой</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.cardOrders}</div>
                      <p className="text-xs text-slate-500">Карта</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, cash: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Оплата наличными</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.cashOrders}</div>
                      <p className="text-xs text-slate-500">Наличные</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, daily: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Ежедневные клиенты</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.dailyCustomers}</div>
                      <p className="text-xs text-slate-500">Каждый день</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, evenDay: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Четные дни</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.evenDayCustomers}</div>
                      <p className="text-xs text-slate-500">Четные числа</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, oddDay: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Нечетные дни</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.oddDayCustomers}</div>
                      <p className="text-xs text-slate-500">Нечетные числа</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, special: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Особые предпочтения</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.specialPreferenceCustomers}</div>
                      <p className="text-xs text-slate-500">С особенностями</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, calories1200: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">1200 калорий</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.orders1200}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, calories1600: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">1600 калорий</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.orders1600}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, calories2000: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">2000 калорий</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.orders2000}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, calories2500: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">2500 калорий</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.orders2500}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, calories3000: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">3000 калорий</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.orders3000}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, singleItem: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">1 блюдо в заказе</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.singleItemOrders}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {setActiveTab('orders'); setFilters({...filters, multiItem: true})}}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">2+ блюда в заказе</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.multiItemOrders}</div>
                      <p className="text-xs text-slate-500">Заказов</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Управление Заказами</CardTitle>
                    <CardDescription>
                      Просмотр и управление всеми заказами
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                      <Filter className="w-4 h-4 mr-2" />
                      Фильтры
                    </Button>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Создать заказ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Date Selector */}
                <div className="flex items-center justify-center mb-6 space-x-2">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex space-x-1">
                    {getDateRange().map((date, index) => (
                      <Button
                        key={index}
                        variant={date.toDateString() === selectedDate.toDateString() ? "default" : "outline"}
                        size="sm"
                        className="w-10 h-10 p-0"
                        onClick={() => setSelectedDate(date)}
                      >
                        {date.getDate()}
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="mb-6 p-4 border rounded-lg bg-slate-50">
                    <h3 className="font-medium mb-4">Фильтры</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.successful}
                          onChange={(e) => setFilters({...filters, successful: e.target.checked})}
                          className="rounded"
                        />
                        <span className="text-sm">Успешные заказы</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.failed}
                          onChange={(e) => setFilters({...filters, failed: e.target.checked})}
                          className="rounded"
                        />
                        <span className="text-sm">Неуспешные заказы</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.prepaid}
                          onChange={(e) => setFilters({...filters, prepaid: e.target.checked})}
                          className="rounded"
                        />
                        <span className="text-sm">Предоплаченные</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.unpaid}
                          onChange={(e) => setFilters({...filters, unpaid: e.target.checked})}
                          className="rounded"
                        />
                        <span className="text-sm">Неоплаченные</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Orders Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">№</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Клиент</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Время</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Кол-во</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Калории</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Особенности</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Адрес</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Статус</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Телефон</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50 cursor-pointer">
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900">
                              {order.orderNumber}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.customer.name}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.deliveryTime}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.quantity}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.calories}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.specialFeatures ? 'Есть' : 'Нет'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.deliveryAddress}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(order.orderStatus)} mr-2`}></div>
                                <span className="text-sm">{getStatusText(order.orderStatus)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              {order.customer.phone}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                              <input type="checkbox" className="rounded" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Actions */}
                <div className="flex justify-between items-center mt-4">
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить выбранные
                    </Button>
                    <Button variant="outline" size="sm">
                      Добавить в закладки
                    </Button>
                    <Button variant="outline" size="sm">
                      Создать особенность
                    </Button>
                  </div>
                  <Button>
                    Сохранить изменения
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>История Действий</CardTitle>
                <CardDescription>
                  История ваших действий в системе
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  Здесь будет история ваших действий
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}