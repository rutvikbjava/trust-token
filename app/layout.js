import './globals.css';

export const metadata = {
  title: 'Blockchain IoT Authentication',
  description: 'Decentralized authentication for IoT devices using blockchain technology',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ 
        margin: 0, 
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", 
        background: '#000000',
        color: '#F7F7F7',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}>
        {/* Navigation */}
        <nav style={styles.nav}>
          <div style={styles.navContainer}>
            <div style={styles.navLeft}>
              <div style={styles.logo}>
                <span style={styles.logoIcon}>⛓</span>
                <span style={styles.logoText}>BlockAuth</span>
              </div>
            </div>
            <div style={styles.navRight}>
              <a href="/" style={styles.navLink}>Dashboard</a>
              <a href="#devices" style={styles.navLink}>Devices</a>
              <a href="#blockchain" style={styles.navLink}>Blockchain</a>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        {children}

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerContainer}>
            <div style={styles.footerContent}>
              <div style={styles.footerLeft}>
                <p style={styles.footerText}>
                  © 2026 BlockAuth. Powered by blockchain technology.
                </p>
              </div>
              <div style={styles.footerRight}>
                <a href="#" style={styles.footerLink}>Documentation</a>
                <a href="#" style={styles.footerLink}>API</a>
                <a href="#" style={styles.footerLink}>GitHub</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

const styles = {
  nav: {
    background: '#000000',
    borderBottom: '1px solid #252525',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backdropFilter: 'blur(8px)',
  },
  navContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 20px',
    height: '72px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '20px',
    fontWeight: '700',
    color: '#F7F7F7',
  },
  logoIcon: {
    fontSize: '28px',
    color: '#8A5CF6',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  navRight: {
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
  },
  navLink: {
    color: '#A7A7A7',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'color 0.2s',
    cursor: 'pointer',
  },
  footer: {
    background: '#0A0A0A',
    borderTop: '1px solid #252525',
    padding: '48px 20px',
    marginTop: '120px',
  },
  footerContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  footerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    '@media (min-width: 768px)': {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  },
  footerLeft: {},
  footerText: {
    color: '#777777',
    fontSize: '14px',
    margin: 0,
  },
  footerRight: {
    display: 'flex',
    gap: '24px',
  },
  footerLink: {
    color: '#A7A7A7',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'color 0.2s',
  },
};
