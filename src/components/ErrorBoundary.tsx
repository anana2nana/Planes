import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Si se indica, el error se muestra en línea (dentro de una sección) en vez de a pantalla completa. */
  inline?: boolean
}

/** Evita la "pantalla en blanco": si algo falla al dibujar, muestra el error y un botón para recargar. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de interfaz', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const detail = `${error.name}: ${error.message}`
    return (
      <div className={this.props.inline ? 'p-4' : 'flex min-h-dvh flex-col items-center justify-center bg-cream p-6 text-center'}>
        <p className="text-2xl">😵‍💫</p>
        <p className="mt-2 font-bold">Algo ha fallado aquí</p>
        <p className="mt-1 text-sm text-muted">Haz una captura de este mensaje para arreglarlo:</p>
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-stone-100 p-3 text-left text-xs text-rose-700">
          {detail}
        </pre>
        <button
          onClick={() => location.reload()}
          className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white active:scale-95"
        >
          Recargar
        </button>
      </div>
    )
  }
}
