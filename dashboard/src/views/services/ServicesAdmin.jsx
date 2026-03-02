import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api.js';
import { useMessage } from '../../messageContext';
import ServiceForm from './ServiceForm.jsx';
import './services.css';

/**
 * ServicesAdmin - Component for managing all custom systemd services by administrator
 * Shows a list of services and allows creating new ones and editing existing
 */
const ServicesAdmin = () => {
  const navigate = useNavigate();
  const { setMessageInfo } = useMessage();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/service/');
      setServices(response.data);
    } catch (error) {
      setMessageInfo('error', `Failed to load services: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveService = async (formData, isNew) => {
    try {
      if (isNew) {
        const response = await api.post('/service/', formData);
        setMessageInfo('success', `Service "${formData.service_long_name}" created successfully`);
        setShowServiceForm(false);
        fetchServices();
        navigate(`/services/${response.data.id}`);
      } else {
        // update existing
        const id = selectedService?.id;
        if (!id) throw new Error('No service selected for update');
        const response = await api.patch(`/service/${id}/`, formData);
        setMessageInfo('success', `Service "${formData.service_long_name}" updated successfully`);
        setShowServiceForm(false);
        setSelectedService(null);
        fetchServices();
      }
    } catch (error) {
      setMessageInfo('error', `Failed to ${isNew ? 'create' : 'update'} service: ${error.message}`);
    }
  };

  const handleDeleteService = async (serviceId, serviceName) => {
    if (window.confirm(`Are you sure you want to delete the service "${serviceName}"?`)) {
      try {
        await api.delete(`/service/${serviceId}/`);
        setMessageInfo('success', `Service "${serviceName}" deleted successfully`);
        fetchServices();
      } catch (error) {
        setMessageInfo('error', `Failed to delete service: ${error.message}`);
      }
    }
  };

  const openEditForm = (service) => {
    setSelectedService(service);
    setShowServiceForm(true);
  };

  const getServiceStatus = (service) => {
    return service.enabled ? '✓ Enabled' : '∼ Disabled';
  };

  if (loading) {
    return <div className="loading">Loading services...</div>;
  }

  return (
    <div className="services-admin-container">
      <div className="page-header">
        <h1>Services</h1>
        <p className="subtitle">Manage custom systemd services</p>
      </div>

      <div className="section-toolbar">
        <button
          className="btn btn-primary"
          onClick={() => { setSelectedService(null); setShowServiceForm(true); }}
        >
          + Create New Service
        </button>
      </div>

      {services.length > 0 ? (
        <div className="services-grid">
          {services.map(service => (
            <div key={service.id} className="service-card">
              <div className="card-header">
                <h3>{service.service_long_name}</h3>
                <div className="service-meta">
                  <code className="service-shortname">{service.service_short_name}</code>
                  <span className={`service-type ${service.service_type}`}>
                    {service.service_type === 1 ? '⏱ One-Time' : '⏰ Timer'}
                  </span>
                </div>
              </div>

              {service.description && (
                <p className="card-description">{service.description}</p>
              )}

              <div className="card-stats">
                <div className="stat">
                  <span className="label">Parameters</span>
                  <span className="value">{service.parameters?.length || 0}</span>
                </div>

              </div>

              <div className="card-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/services/${service.id}`)}
                >
                  Manage
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => openEditForm(service)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteService(service.id, service.service_long_name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No services yet</h2>
          <p>Create your first service to get started</p>
        </div>
      )}

      {showServiceForm && (
        <ServiceForm
          onSave={(data) => handleSaveService(data, !selectedService)}
          onCancel={() => { setShowServiceForm(false); setSelectedService(null); }}
          isNew={!selectedService}
          initialData={selectedService}
        />
      )}
    </div>
  );
};

export default ServicesAdmin;
