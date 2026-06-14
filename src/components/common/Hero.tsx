import React from 'react';

export const Hero: React.FC = () => {
  const heroImg = '/hero_banner.png';
  return (
    <section className="hero-section" style={{
      backgroundImage: `url(${heroImg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '4rem 2rem',
      position: 'relative',
      color: 'var(--text-primary)',
      textAlign: 'center',
    }}>
      <div className="hero-overlay" style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
      }} />
      <div className="hero-content" style={{ position: 'relative', zIndex: 1 }}>
        <h1 className="hero-title" style={{
          fontFamily: 'var(--font-primary)',
          fontWeight: 900,
          fontSize: '2.5rem',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, var(--accent-teal) 0%, #7b2ff7 70%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Evolution Lab
        </h1>
        <p className="hero-subtitle" style={{
          fontFamily: 'var(--font-fallback)',
          fontSize: '1.1rem',
          opacity: 0.9,
        }}>
          Implementación Inteligente, ejecución Implecable
        </p>
      </div>
    </section>
  );
};

export default Hero;
