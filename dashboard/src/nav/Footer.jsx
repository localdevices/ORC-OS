import './Footer.css'
import orcLogo from '/orc_favicon.svg'


const Footer = ({apiStatus}) => {
    return (
      <footer className="footer">
        <div className="footer-content">
          <img src={orcLogo} alt="ORC Logo" width="20" className="footer-logo"/>
            {' '}
          <p>ORC-OS {apiStatus?.release} v{apiStatus.version} © {new Date().getFullYear()} <a className="dark-link" href="https://rainbowsensing.com">https://rainbowsensing.com</a></p>
        </div>
      </footer>
    );
};

export default Footer;
