import { createContext } from 'react-router'

/** The verified session, set by authMiddleware for every signed-in route. */
export const sessionContext = createContext<Session | null>(null)
