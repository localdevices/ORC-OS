import {CodeBlock} from "../../utils/codeBlock.jsx";
import PropTypes from "prop-types";

export const FileTransferModal = ({setShowModal, settings}) => {

  // const [copied, setCopied] = useState(false);

  // const code = settings.sample_scp_ip;
  // const title = "Secure copy example";
  // const codeId = "cmdScpIp"
  //
  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };
  return (
    <>
      <div className="sidebar-overlay"></div> {/*make background grey*/}
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "1024px", marginTop: "30px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Video transfer examples</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeModal}
              ></button>
            </div>

            <div className="modal-body">
              <div>
                To set up video feeds, files need to be transferred to my designated incoming directory
                <code>{settings.sample_sftp_details.incoming_directory}</code>. The following
                examples show how to transfer videos to me via secure copy (SCP) or secure file transfer protocol
                (SFTP).
                You can use any of these examples to set up video transfer. For the SCP examples, you need access
                without having to type a password. This can be achieved by using a public/private key pair as described
                in the second section below.
              </div>
              <hr/>
              <CodeBlock
                code={settings.sample_scp_ip}
                title="Secure copy example using my IP address"
                codeId="cmdScpIp"
                helpText="Use this command on the device that collects videos to transfer videos to me via SCP using
                my internal IP address. Your device recording videos must be on the same network."
              />
              <CodeBlock
                code={settings.sample_scp_hostname}
                title="Secure copy example using my hostname"
                codeId="cmdScpHostname"
                helpText="Use this command on the device that collects videos to transfer videos to me via SCP using
                my hostname. Your device recording videos must be on the same network."
              />
              <CodeBlock
                code={[
                  `IP-address: ${settings.sample_sftp_details.IP}\n`,
                  `hostname: ${settings.sample_sftp_details.hostname}\n`,
                  `username: ${settings.sample_sftp_details.username}\n`,
                  `directory to write into: ${settings.sample_sftp_details.incoming_directory}\n`
                ]}
                title="SFTP transfer from an IP camera"
                codeId="cmdScpHostname"
                helpText="Look for a setting for SFTP transfer on your IP camera. Use these details in the settings form."
              />
              <hr/>
              <div className="mt-3">
              <h5>Setting up passwordless SCP using SSH keys</h5>
                <p>
                  To securely copy files from the device collecting videos without entering a password each time,
                  you need to set up an <strong>SSH public/private key pair</strong>.
                  This allows your video collecting device to authenticate securely using cryptographic keys.
                </p>

                <hr/>

                <h6>1. Login on the video collecting device and generate an SSH key pair</h6>
                <p>
                  On the device that generates the video files, run:
                </p>
                <CodeBlock
                  code='ssh-keygen -t ed25519 -C "your-email@example.com"'
                />
                <p>
                  When prompted:
                </p>
                <ul>
                  <li>Press <strong>Enter</strong> to accept the default file location</li>
                  <li>Optionally set a passphrase (recommended)</li>
                </ul>
                <p>
                  This creates:
                </p>
                <ul>
                  <li><code>~/.ssh/id_ed25519</code> (private key – keep this secret)</li>
                  <li><code>~/.ssh/id_ed25519.pub</code> (public key)</li>
                </ul>

                <hr/>

                <h6>2. Copy your public key to me (ORC-OS device)</h6>
                <p>
                  I already filled out my <code>user</code> and <code>device-ip</code> with the correct values for you!
                </p>
                <CodeBlock
                  code={`ssh-copy-id ${settings.sample_sftp_details.username}@${settings.sample_sftp_details.IP}`}
                />
                <p>
                  If <code>ssh-copy-id</code> is not available, you can copy it manually:
                </p>
                <CodeBlock
                  code={`cat ~/.ssh/id_ed25519.pub | ssh ${settings.sample_sftp_details.username}@${settings.sample_sftp_details.IP} "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys`}
                />
                <hr/>

                <h6>3. Verify passwordless login</h6>
                <p>
                  Test if you can login to my back-end with SSH without a password:
                </p>
                <CodeBlock
                  code={`ssh ${settings.sample_sftp_details.username}@${settings.sample_sftp_details.IP}`}
                />

                <p>
                  If login succeeds without asking for a password, setup is complete.
                </p>

                <hr/>

                <h6>4. Use SCP without a password</h6>
                <p>
                  You can now securely copy files using <code>scp</code> as shown in the above examples.
                </p>

                <p className="text-muted">
                  🔐 NOTE: This is very secure because your private key never leaves your computer. Only the public key is stored on the device.
                </p>
              </div>

              {/*<div className="mb-0 mt-0">*/}
              {/*  <label htmlFor={codeId} className="form-label">*/}
              {/*    {title}*/}
              {/*  </label>*/}
              {/*  <div className="position-relative mt-2">*/}
              {/*    <pre className="bg-dark text-light p-3 rounded mb-0">*/}
              {/*      <code id={codeId}>*/}
              {/*        {code}*/}

              {/*      </code>*/}
              {/*    </pre>*/}

              {/*    /!* Copy button *!/*/}
              {/*    <button*/}
              {/*      type="button"*/}
              {/*      // className="btn btn-sm btn-dark position-absolute top-0 end-0 m-2"*/}
              {/*      className="btn btn-sm bg-dark text-light position-absolute top-0 end-0 m-2 border-0"*/}
              {/*      onClick={handleCopy}*/}
              {/*      title="Copy to clipboard"*/}
              {/*      aria-label="Copy to clipboard"*/}
              {/*      style={{ transition: "background-color 0.15s ease" }}*/}
              {/*    >*/}
              {/*      {copied ? <FiCheck /> : <FiCopy />}*/}
              {/*    </button>*/}
              {/*  </div>*/}
              {/*  <div className="help-block" style={{marginTop: "80px"}}>*/}
              {/*    Select or improve the set water level visually with this slider, before processing. If you want to*/}
              {/*    remove a set water level and optically re-estimate it, click on the right-hand button below.*/}
              {/*  </div>*/}
              {/*</div>*/}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
              >
                Close
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
FileTransferModal.propTypes = {
  setShowModal: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
};
