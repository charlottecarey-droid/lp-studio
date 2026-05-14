import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './Page.module.css';

export default function Page() {
  const [activeChapter, setActiveChapter] = useState('chapter-1');

  useEffect(() => {
    const handleScroll = () => {
      const chapters = ['chapter-1', 'chapter-2', 'chapter-3'];
      let current = chapters[0];
      
      for (const id of chapters) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 300) {
            current = id;
          }
        }
      }
      setActiveChapter(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroVideo} style={{ backgroundColor: '#1A1A1A' }}>
          {/* Placeholder for video poster */}
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(14,14,16,1) 0%, rgba(30,30,35,1) 100%)' }}></div>
        </div>
        
        <header className={styles.heroHeader}>
          <div className={styles.heroLogo}>The Blueprint</div>
          <div className={styles.heroDate}>Issue No. 04</div>
        </header>

        <div className={styles.heroContent}>
          <motion.span 
            className={styles.heroEyebrow}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            A Story of Transformation
          </motion.span>
          <motion.h1 
            className={`${styles.heroTitle} ${styles.serif}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Finding the <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Light</span> in Digital Dentistry
          </motion.h1>
          <motion.p 
            className={styles.heroSubtitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            How Dr. Sarah Jenkins turned a struggling practice into a modern marvel with North Light Dental.
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        {/* Sidebar Navigation */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Chapters</div>
          <button 
            className={`${styles.navLink} ${activeChapter === 'chapter-1' ? styles.active : ''}`}
            onClick={() => scrollTo('chapter-1')}
            style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }}
          >
            I. The Weight of Analog
          </button>
          <button 
            className={`${styles.navLink} ${activeChapter === 'chapter-2' ? styles.active : ''}`}
            onClick={() => scrollTo('chapter-2')}
            style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }}
          >
            II. A Paradigm Shift
          </button>
          <button 
            className={`${styles.navLink} ${activeChapter === 'chapter-3' ? styles.active : ''}`}
            onClick={() => scrollTo('chapter-3')}
            style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }}
          >
            III. The New Standard
          </button>
        </aside>

        {/* Article Body */}
        <main className={styles.mainContent}>
          {/* Chapter 1 */}
          <section id="chapter-1" className={styles.chapter}>
            <span className={styles.chapterNumber}>Chapter I</span>
            <h2 className={`${styles.chapterTitle} ${styles.serif}`}>The Weight of Analog</h2>
            
            <div className={styles.prose}>
              <p>
                In 2021, North Light Dental was a practice operating at full capacity, but running on fumes. The waiting room was full, but the back office was drowning in plaster, physical impressions, and shipping delays. Dr. Sarah Jenkins, the lead practitioner, felt the strain in every aspect of her day.
              </p>
              <p>
                "We were doing good work, but the process was exhausting. PVS impressions were uncomfortable for patients and prone to errors. We were spending hours managing lab relationships and dealing with remakes," Dr. Jenkins recalls. The physical toll was matching the operational one.
              </p>
            </div>

            <div className={styles.pullQuote}>
              <p className={`${styles.pullQuoteText} ${styles.serif} ${styles.italic}`}>
                "I didn't go to dental school to manage shipping logistics. I went to treat patients."
              </p>
              <span className={styles.pullQuoteAuthor}>Dr. Sarah Jenkins</span>
            </div>
            
            <div className={styles.bRollStrip}>
              <div className={styles.bRollImage} style={{ background: 'linear-gradient(to right, #E0DCD0, #D0CCC0)' }}></div>
              <div className={styles.bRollImage} style={{ background: 'linear-gradient(to right, #D0CCC0, #C0BCA0)' }}></div>
              <div className={styles.bRollImage} style={{ background: 'linear-gradient(to right, #C0BCA0, #B0AC90)' }}></div>
            </div>
          </section>

          {/* Chapter 2 */}
          <section id="chapter-2" className={styles.chapter}>
            <span className={styles.chapterNumber}>Chapter II</span>
            <h2 className={`${styles.chapterTitle} ${styles.serif}`}>A Paradigm Shift</h2>
            
            <div className={styles.prose}>
              <p>
                The turning point came when North Light integrated Dandy's digital workflow. It wasn't just about replacing gooey impressions with a scanner; it was a complete operational overhaul. The transition was immediate and visceral.
              </p>
            </div>

            <div className={styles.statGrid}>
              <div className={styles.statItem}>
                <span className={`${styles.statValue} ${styles.serif}`}>85%</span>
                <span className={styles.statLabel}>Reduction in Remakes</span>
              </div>
              <div className={styles.statItem}>
                <span className={`${styles.statValue} ${styles.serif}`}>15m</span>
                <span className={styles.statLabel}>Saved per Appointment</span>
              </div>
              <div className={styles.statItem}>
                <span className={`${styles.statValue} ${styles.serif}`}>2x</span>
                <span className={styles.statLabel}>Case Acceptance</span>
              </div>
            </div>

            <div className={styles.prose}>
              <p>
                Patients suddenly could see exactly what the doctor was seeing. The digital scans became an educational tool, turning abstract diagnoses into concrete visual evidence. "When a patient sees their arch in full 3D color, they understand instantly. The resistance melts away," says Jenkins.
              </p>
            </div>
          </section>

          {/* Chapter 3 */}
          <section id="chapter-3" className={styles.chapter}>
            <span className={styles.chapterNumber}>Chapter III</span>
            <h2 className={`${styles.chapterTitle} ${styles.serif}`}>The New Standard</h2>
            
            <div className={styles.prose}>
              <p>
                Today, North Light Dental feels entirely different. The chaotic energy of managing physical lab work has been replaced by a quiet, hum of digital efficiency. The staff is happier, the patients are more comfortable, and Dr. Jenkins is finally focused completely on clinical excellence.
              </p>
            </div>

            <div className={styles.pullQuote}>
              <p className={`${styles.pullQuoteText} ${styles.serif} ${styles.italic}`}>
                "We haven't just updated our tools. We've fundamentally changed what it feels like to visit the dentist."
              </p>
              <span className={styles.pullQuoteAuthor}>Dr. Sarah Jenkins</span>
            </div>

            {/* CTA Card */}
            <div className={styles.ctaCard}>
              <h3 className={`${styles.ctaTitle} ${styles.serif}`}>Ready to write your own story?</h3>
              <p className={styles.ctaText}>
                Join North Light Dental and thousands of other practices modernizing their workflow with Dandy.
              </p>
              <button className={styles.ctaButton}>
                Book a Demo
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}