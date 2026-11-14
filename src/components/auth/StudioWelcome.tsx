/** An illustration of the training cycle, with no simulated user metrics. */
export function StudioWelcome() {
  return <section className="studio-auth-intro" aria-labelledby="studio-auth-title">
    <p className="studio-eyebrow studio-welcome-eyebrow"><span aria-hidden="true" />Entrenamiento con intención</p>
    <h1 id="studio-auth-title">Tu próximo paso.<br /><em>Una mejor versión.</em></h1>
    <p className="studio-auth-lead">Dale dirección a tu esfuerzo. Un espacio para planificar, entrenar y descubrir cómo vas avanzando.</p>
    <div className="studio-welcome-art" aria-hidden="true">
      <svg viewBox="0 0 520 174" fill="none">
        <path className="studio-welcome-grid" d="M0 42H520M0 87H520M0 132H520M74 0V174M174 0V174M274 0V174M374 0V174M474 0V174" />
        <path className="studio-welcome-area" d="M0 150C52 150 50 120 100 122S156 143 200 104S246 120 285 75S336 98 380 51S431 65 474 26S500 21 520 12V174H0Z" />
        <path className="studio-welcome-line" d="M0 150C52 150 50 120 100 122S156 143 200 104S246 120 285 75S336 98 380 51S431 65 474 26S500 21 520 12" />
        <circle cx="380" cy="51" r="6" className="studio-welcome-point" />
        <circle cx="380" cy="51" r="15" className="studio-welcome-halo" />
      </svg>
      <span>El progreso tiene su propio ritmo.</span>
    </div>
    <div id="studio-method" className="studio-method">
      <div><span aria-hidden="true">01</span><div><h2>Encuentra tu dirección</h2><p>Tu plan, tus ejercicios y tus objetivos, conectados.</p></div></div>
      <div><span aria-hidden="true">02</span><div><h2>Haz que cada sesión cuente</h2><p>Registra tu esfuerzo y retoma desde donde lo dejaste.</p></div></div>
      <div><span aria-hidden="true">03</span><div><h2>Aprende de tu progreso</h2><p>Entrena a tu ritmo, por tu cuenta o con tu entrenador.</p></div></div>
    </div>
    <p className="studio-auth-footnote">Para atletas independientes y entrenadores.</p>
  </section>;
}
