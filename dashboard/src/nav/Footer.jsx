import './Footer.css'
import orcLogo from '/orc_favicon.svg'


const Footer = () => {
    return (
      <footer className="footer">
        <div className="footer-content">
          <img src={orcLogo} alt="ORC Logo" width="20" className="footer-logo"/>
            {' '}
          <p>© {new Date().getFullYear()} <a className="dark-link" href="https://rainbowsensing.com">https://rainbowsensing.com</a>. All rights reserved.</p>
        </div>
      </footer>
    );
};

export default Footer;
