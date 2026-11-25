export default function Placeholder({ title, task }: { title: string; task: string }) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p className="muted">Esta pantalla se construye en la tarea {task} de <code>replica/PLAN.md</code>.</p>
    </section>
  )
}
