import { useState } from 'react';
import api from "../api/api.js";
import {useMessage} from '../messageContext';
import PropTypes from "prop-types";

export const PasswordChangeModal = ({setShowModal}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const {setMessageInfo} = useMessage();

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const missingFields = !currentPassword || !newPassword || !confirmPassword;
  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  // Password change submit (adjust API endpoint as needed)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setChanging(true);
      await api.post('/auth/change_password/', null,{
        params: {
          current_password: currentPassword,
          new_password: newPassword
        },
        withCredentials: true,
      });
      setMessageInfo('success', 'Password changed successfully');
      setShowModal(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      setError(error.response.data.detail);
      // setMessageInfo("error", error.response.data.detail);
    } finally {
      setChanging(false);
    }
  };
  return (
    <>
      <div className="sidebar-overlay"></div> {/*make background grey*/}
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px", marginTop: "140px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Change password</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeModal}
              ></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleChangePassword} style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => {setError('');setCurrentPassword(e.target.value)}}
                />
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => {setError('');setNewPassword(e.target.value)}}
                  style={{ marginTop: "8px" }}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {setError('');setConfirmPassword(e.target.value)}}
                  style={{ marginTop: "8px" }}
                />
                <button
                  className="btn"
                  type="submit"
                  disabled={changing || missingFields}
                >Change password
                </button>
                {confirmPassword.length > 0 && (
                  <p style={{ color: error ? "red" : passwordsMatch ? "green" : "red", margin: "6px 0" }}>
                    {error ? error: passwordsMatch ? "New passwords match" : "New passwords do not match"}
                  </p>
                )}
              </form>
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
PasswordChangeModal.propTypes = {
  setShowModal: PropTypes.bool.isRequired
};
