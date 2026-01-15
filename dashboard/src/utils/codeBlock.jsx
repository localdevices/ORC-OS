import {useState} from "react";
import { FiCopy, FiCheck } from "react-icons/fi";

export const CodeBlock = ({code, title, codeId, helpText}) => {

  const [copied, setCopied] = useState(false);
  // const code = settings.sample_scp_ip;
  // const title = "Secure copy example";
  // const codeId = "cmdScpIp"
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mb-0 mt-0">
      {codeId && (
      <label htmlFor={codeId ? codeId : ""} className="form-label">
        {title && title}
      </label>)}
      {helpText && (
        <div className="help-block">
          {helpText}
        </div>
      )}
      <div className="position-relative mt-2 mb-3">
        <pre className="bg-dark text-light p-3 rounded mb-0">
          <code id={codeId ? codeId : ""}>
            {code}
          </code>
        </pre>

        {/* Copy button */}
        <button
          type="button"
          // className="btn btn-sm btn-dark position-absolute top-0 end-0 m-2"
          className="btn btn-sm bg-dark text-light position-absolute top-0 end-0 m-2 border-0"
          onClick={handleCopy}
          title="Copy to clipboard"
          aria-label="Copy to clipboard"
          style={{ transition: "background-color 0.15s ease" }}
        >
          {copied ? <FiCheck /> : <FiCopy />}
        </button>
      </div>
    </div>
  )};
