'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * ErrorBoundary - Catches JavaScript errors anywhere in the child component tree
 * Prevents the entire app from crashing when an error occurs in a component
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    
    // You can also log the error to an error reporting service here
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <CardTitle>Что-то пошло не так</CardTitle>
              </div>
              <CardDescription>
                Произошла ошибка при отображении этой части приложения
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTitle>Детали ошибки</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="font-mono text-xs overflow-auto max-h-40 bg-red-50 p-2 rounded">
                    {this.state.error?.toString()}
                  </div>
                </AlertDescription>
              </Alert>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Alert>
                  <AlertTitle>Stack Trace (Development Only)</AlertTitle>
                  <AlertDescription className="mt-2">
                    <pre className="text-xs overflow-auto max-h-60 bg-slate-100 p-2 rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-2">
                <Button onClick={this.handleReset} className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Попробовать снова</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'}
                >
                  Вернуться на главную
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary