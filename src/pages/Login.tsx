import { useSearchParams } from 'react-router-dom'
import Auth, { type AuthView } from './Auth'

interface LoginProps {
  initialView?: AuthView
}

export default function Login({ initialView }: LoginProps) {
  const [searchParams] = useSearchParams()
  const viewFromQuery = searchParams.get('view') as AuthView | null

  const resolvedView: AuthView =
    initialView ||
    (viewFromQuery && ['welcome', 'login', 'register'].includes(viewFromQuery)
      ? viewFromQuery
      : 'welcome')

  return <Auth initialView={resolvedView} />
}
