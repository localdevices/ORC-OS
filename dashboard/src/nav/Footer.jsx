import './Footer.css'

const Footer = () => {
    return (
      <footer className="footer">
        <div className="footer-content">
          <img src="./public/orc_favicon.svg" alt="ORC Logo" width="20" className="footer-logo"/>
            {' '}
          <p>© {new Date().getFullYear()} <a href="https://rainbowsensing.com">Rainbowsensing</a>. All rights reserved.</p>
        </div>
      </footer>
    );
};

export default Footer;