import { redirect } from 'next/navigation'

// The site root has no content of its own yet: send visitors to the playground.
export default function Home() {
  redirect('/playground')
}
