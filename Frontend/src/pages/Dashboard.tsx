import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import { Calendar, FileText, AlertCircle, Users, Stethoscope, Clock, TrendingUp, Activity, UserCheck, Database } from 'lucide-react';

interface CitaMedica {
  id_cita_medica: number;
  fecha_hora_programada: string;
  estado: string;
  personal_medico: {
    persona: {
      prenombres: string;
      primer_apellido: string;
      segundo_apellido: string;
    };
    especialidad: {
      descripcion: string;
    };
  };
  paciente?: {
    persona: {
      prenombres: string;
      primer_apellido: string;
      segundo_apellido: string;
    };
  };
}

interface ServicioMedico {
  id_servicio_medico: number;
  fecha_servicio: string;
  cita_medica: {
    personal_medico: {
      persona: {
        prenombres: string;
        primer_apellido: string;
        segundo_apellido: string;
      };
    };
  };
  consulta_medica?: {
    tipo_servicio: {
      nombre: string;
    };
  };
}

interface SolicitudAcceso {
  id_solicitud: number;
  descripcion: string;
  motivo: string;
  fecha_solicitud: string;
  estado_solicitud: string;
  persona: {
    prenombres: string;
    primer_apellido: string;
    segundo_apellido: string;
    dni_idcarnet: string;
  };
}

interface DashboardStats {
  totalCitas: number;
  citasHoy: number;
  citasCompletadas: number;
  citasPendientes: number;
  totalPacientes: number;
  totalHistorias: number;
  solicitudesPendientes: number;
  serviciosHoy: number;
}

const Dashboard: React.FC = () => {
  const { user } = useUser();
  
  if (!user) return null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Different dashboard content based on role
  const renderDashboardContent = () => {
    switch (user.currentRole) {
      case 'patient':
        return <PatientDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'medical':
        return <MedicalDashboard />;
      default:
        return <PatientDashboard />;
    }
  };

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">
          {getGreeting()}, {user.name}
        </h1>
        <p className="text-gray-600 mt-1">
          Bienvenido al Sistema de Gestión de Historias Clínicas
        </p>
      </div>

      {renderDashboardContent()}
    </div>
  );
};

const PatientDashboard: React.FC = () => {
  const { user } = useUser();
  const [upcomingAppointments, setUpcomingAppointments] = useState<CitaMedica[]>([]);
  const [recentServices, setRecentServices] = useState<ServicioMedico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPatientData();
    }
  }, [user]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener IDs de personas asociadas al usuario
      const profileIds = user?.profiles?.map(p => parseInt(p.id)) || [];
      
      if (profileIds.length === 0) {
        setLoading(false);
        return;
      }

      // Obtener pacientes asociados
      const { data: pacientesData, error: pacientesError } = await supabase
        .from('paciente')
        .select('id_paciente')
        .in('id_persona', profileIds);

      if (pacientesError) throw pacientesError;

      const pacienteIds = pacientesData?.map(p => p.id_paciente) || [];

      if (pacienteIds.length === 0) {
        setLoading(false);
        return;
      }

      // Obtener próximas citas
      const { data: citasData, error: citasError } = await supabase
        .from('cita_medica')
        .select(`
          id_cita_medica,
          fecha_hora_programada,
          estado,
          personal_medico:id_personal_medico (
            persona:id_persona (
              prenombres,
              primer_apellido,
              segundo_apellido
            ),
            especialidad:id_especialidad (
              descripcion
            )
          )
        `)
        .in('id_paciente', pacienteIds)
        .gte('fecha_hora_programada', new Date().toISOString())
        .order('fecha_hora_programada', { ascending: true })
        .limit(5);

      if (citasError) throw citasError;

      // Obtener servicios médicos recientes
      const { data: serviciosData, error: serviciosError } = await supabase
        .from('servicio_medico')
        .select(`
          id_servicio_medico,
          fecha_servicio,
          cita_medica:id_cita_medica (
            personal_medico:id_personal_medico (
              persona:id_persona (
                prenombres,
                primer_apellido,
                segundo_apellido
              )
            )
          ),
          consulta_medica:consulta_medica (
            tipo_servicio:id_tipo_servicio (
              nombre
            )
          )
        `)
        .in('id_cita_medica', 
          await supabase
            .from('cita_medica')
            .select('id_cita_medica')
            .in('id_paciente', pacienteIds)
            .then(({ data }) => data?.map(c => c.id_cita_medica) || [])
        )
        .order('fecha_servicio', { ascending: false })
        .limit(5);

      if (serviciosError) throw serviciosError;

      setUpcomingAppointments(citasData || []);
      setRecentServices(serviciosData || []);

    } catch (error) {
      console.error('Error fetching patient data:', error);
      setError('Error al cargar los datos del paciente');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Upcoming Appointments */}
      <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Próximas Citas</h2>
          <Link to="/appointments" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Ver todas
          </Link>
        </div>
        
        {upcomingAppointments.length > 0 ? (
          <div className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id_cita_medica} className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">
                      Dr. {appointment.personal_medico?.persona?.prenombres} {appointment.personal_medico?.persona?.primer_apellido}
                    </p>
                    <p className="text-sm text-gray-600">{appointment.personal_medico?.especialidad?.descripcion}</p>
                    <p className="text-xs text-gray-500 mt-1">Estado: {appointment.estado}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(appointment.fecha_hora_programada).toLocaleDateString('es-ES')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(appointment.fecha_hora_programada).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p>No tienes citas programadas</p>
            <Link to="/appointments" className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
              Programar una cita
            </Link>
          </div>
        )}
      </div>

      {/* Recent Medical Records */}
      <div className="col-span-1 bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Servicios Recientes</h2>
          <Link to="/medical-records" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Ver todo
          </Link>
        </div>
        
        <div className="space-y-4">
          {recentServices.length > 0 ? (
            recentServices.map((service) => (
              <div key={service.id_servicio_medico} className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between">
                  <div className="flex items-center">
                    <Stethoscope className="h-5 w-5 text-green-600 mr-2" />
                    <p className="font-medium text-gray-800">
                      {service.consulta_medica?.[0]?.tipo_servicio?.nombre || 'Consulta Médica'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(service.fecha_servicio).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Dr. {service.cita_medica?.personal_medico?.persona?.prenombres} {service.cita_medica?.personal_medico?.persona?.primer_apellido}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm">No hay servicios recientes</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <Link to="/appointments" className="bg-white p-4 rounded-lg shadow-sm flex items-center hover:bg-blue-50 transition-colors">
          <div className="p-3 bg-blue-100 rounded-full">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <span className="ml-3 font-medium text-gray-800">Programar Cita</span>
        </Link>
        
        <Link to="/medical-records" className="bg-white p-4 rounded-lg shadow-sm flex items-center hover:bg-green-50 transition-colors">
          <div className="p-3 bg-green-100 rounded-full">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
          <span className="ml-3 font-medium text-gray-800">Ver Historia Clínica</span>
        </Link>
        
        <button className="bg-white p-4 rounded-lg shadow-sm flex items-center hover:bg-purple-50 transition-colors">
          <div className="p-3 bg-purple-100 rounded-full">
            <AlertCircle className="h-6 w-6 text-purple-600" />
          </div>
          <span className="ml-3 font-medium text-gray-800">Solicitar Ayuda</span>
        </button>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<SolicitudAcceso[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCitas: 0,
    citasHoy: 0,
    citasCompletadas: 0,
    citasPendientes: 0,
    totalPacientes: 0,
    totalHistorias: 0,
    solicitudesPendientes: 0,
    serviciosHoy: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener solicitudes pendientes
      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from('solicitud')
        .select(`
          id_solicitud,
          descripcion,
          motivo,
          fecha_solicitud,
          estado_solicitud,
          persona:id_persona (
            prenombres,
            primer_apellido,
            segundo_apellido,
            dni_idcarnet
          )
        `)
        .eq('estado_solicitud', 'Pendiente')
        .order('fecha_solicitud', { ascending: false })
        .limit(5);

      if (solicitudesError) throw solicitudesError;

      // Obtener estadísticas
      const today = new Date().toISOString().split('T')[0];

      // Total de citas
      const { count: totalCitas } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true });

      // Citas de hoy
      const { count: citasHoy } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .gte('fecha_hora_programada', `${today}T00:00:00`)
        .lt('fecha_hora_programada', `${today}T23:59:59`);

      // Citas completadas
      const { count: citasCompletadas } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Completada');

      // Citas pendientes
      const { count: citasPendientes } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Programada');

      // Total de pacientes
      const { count: totalPacientes } = await supabase
        .from('paciente')
        .select('*', { count: 'exact', head: true });

      // Total de historias clínicas
      const { count: totalHistorias } = await supabase
        .from('historia_clinica')
        .select('*', { count: 'exact', head: true });

      // Solicitudes pendientes
      const { count: solicitudesPendientes } = await supabase
        .from('solicitud')
        .select('*', { count: 'exact', head: true })
        .eq('estado_solicitud', 'Pendiente');

      // Servicios médicos de hoy
      const { count: serviciosHoy } = await supabase
        .from('servicio_medico')
        .select('*', { count: 'exact', head: true })
        .eq('fecha_servicio', today);

      setPendingRequests(solicitudesData || []);
      setStats({
        totalCitas: totalCitas || 0,
        citasHoy: citasHoy || 0,
        citasCompletadas: citasCompletadas || 0,
        citasPendientes: citasPendientes || 0,
        totalPacientes: totalPacientes || 0,
        totalHistorias: totalHistorias || 0,
        solicitudesPendientes: solicitudesPendientes || 0,
        serviciosHoy: serviciosHoy || 0
      });

    } catch (error) {
      console.error('Error fetching admin data:', error);
      setError('Error al cargar los datos administrativos');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      const { error } = await supabase
        .from('solicitud')
        .update({ estado_solicitud: 'Aprobada' })
        .eq('id_solicitud', requestId);

      if (error) throw error;

      // Actualizar la lista
      fetchAdminData();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      const { error } = await supabase
        .from('solicitud')
        .update({ estado_solicitud: 'Rechazada' })
        .eq('id_solicitud', requestId);

      if (error) throw error;

      // Actualizar la lista
      fetchAdminData();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Statistics Cards */}
      <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Citas Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{stats.citasHoy}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pacientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPacientes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Historias Clínicas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalHistorias}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Solicitudes Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.solicitudesPendientes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Access Requests */}
      <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Solicitudes de Acceso Pendientes</h2>
          <Link to="/access-management" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Ver todas
          </Link>
        </div>
        
        {pendingRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solicitante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingRequests.map((request) => (
                  <tr key={request.id_solicitud} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {request.persona?.prenombres} {request.persona?.primer_apellido} {request.persona?.segundo_apellido}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{request.persona?.dni_idcarnet}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(request.fecha_solicitud).toLocaleDateString('es-ES')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleApproveRequest(request.id_solicitud)}
                        className="text-green-600 hover:text-green-800 mr-3"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id_solicitud)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Rechazar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p>No hay solicitudes pendientes</p>
          </div>
        )}
      </div>

      {/* Quick Stats and Actions */}
      <div className="col-span-1 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Estadísticas del Sistema</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Citas Completadas</span>
                <span className="text-sm font-medium text-gray-700">
                  {stats.totalCitas > 0 ? Math.round((stats.citasCompletadas / stats.totalCitas) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ 
                    width: `${stats.totalCitas > 0 ? (stats.citasCompletadas / stats.totalCitas) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Servicios Hoy</span>
                <span className="text-sm font-medium text-gray-700">{stats.serviciosHoy}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${Math.min((stats.serviciosHoy / 10) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Citas Pendientes</span>
                <span className="text-sm font-medium text-gray-700">{stats.citasPendientes}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ width: `${Math.min((stats.citasPendientes / 20) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Acciones Rápidas</h2>
          
          <div className="space-y-3">
            <Link
              to='/access-management'
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <Users className="h-5 w-5 mr-2" />
              Gestionar Usuarios
            </Link>

            <Link
              to='/medical-records'
              className="w-full py-2 px-4 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              <FileText className="h-5 w-5 mr-2" />
              Historias Clínicas
            </Link>

            <button className="w-full py-2 px-4 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors flex items-center justify-center">
              <Database className="h-5 w-5 mr-2" />
              Reportes del Sistema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MedicalDashboard: React.FC = () => {
  const { user } = useUser();
  const [todayAppointments, setTodayAppointments] = useState<CitaMedica[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCitas: 0,
    citasHoy: 0,
    citasCompletadas: 0,
    citasPendientes: 0,
    totalPacientes: 0,
    totalHistorias: 0,
    solicitudesPendientes: 0,
    serviciosHoy: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMedicalData();
    }
  }, [user]);

  const fetchMedicalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener ID del personal médico basado en el DNI del usuario
      const { data: personalMedicoData, error: personalError } = await supabase
        .from('personal_medico')
        .select('id_personal_medico')
        .eq('persona.dni_idcarnet', user?.dni)
        .single();

      if (personalError) throw personalError;

      const personalMedicoId = personalMedicoData?.id_personal_medico;

      if (!personalMedicoId) {
        throw new Error('No se encontró el perfil de personal médico');
      }

      const today = new Date().toISOString().split('T')[0];

      // Obtener citas de hoy
      const { data: citasData, error: citasError } = await supabase
        .from('cita_medica')
        .select(`
          id_cita_medica,
          fecha_hora_programada,
          estado,
          paciente:id_paciente (
            persona:id_persona (
              prenombres,
              primer_apellido,
              segundo_apellido
            )
          )
        `)
        .eq('id_personal_medico', personalMedicoId)
        .gte('fecha_hora_programada', `${today}T00:00:00`)
        .lt('fecha_hora_programada', `${today}T23:59:59`)
        .order('fecha_hora_programada', { ascending: true });

      if (citasError) throw citasError;

      // Obtener estadísticas del médico
      const { count: totalCitas } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .eq('id_personal_medico', personalMedicoId);

      const { count: citasHoy } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .eq('id_personal_medico', personalMedicoId)
        .gte('fecha_hora_programada', `${today}T00:00:00`)
        .lt('fecha_hora_programada', `${today}T23:59:59`);

      const { count: citasCompletadas } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .eq('id_personal_medico', personalMedicoId)
        .eq('estado', 'Completada');

      const { count: citasPendientes } = await supabase
        .from('cita_medica')
        .select('*', { count: 'exact', head: true })
        .eq('id_personal_medico', personalMedicoId)
        .eq('estado', 'Programada');

      // Obtener servicios médicos de hoy
      const { count: serviciosHoy } = await supabase
        .from('servicio_medico')
        .select('*', { count: 'exact', head: true })
        .eq('fecha_servicio', today)
        .in('id_cita_medica', 
          citasData?.map(c => c.id_cita_medica) || []
        );

      setTodayAppointments(citasData || []);
      setStats({
        totalCitas: totalCitas || 0,
        citasHoy: citasHoy || 0,
        citasCompletadas: citasCompletadas || 0,
        citasPendientes: citasPendientes || 0,
        totalPacientes: 0, // No relevante para médicos
        totalHistorias: 0, // No relevante para médicos
        solicitudesPendientes: 0, // No relevante para médicos
        serviciosHoy: serviciosHoy || 0
      });

    } catch (error) {
      console.error('Error fetching medical data:', error);
      setError('Error al cargar los datos médicos');
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (citaId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('cita_medica')
        .update({ estado: newStatus })
        .eq('id_cita_medica', citaId);

      if (error) throw error;

      // Actualizar la lista local
      setTodayAppointments(prev => 
        prev.map(cita => 
          cita.id_cita_medica === citaId 
            ? { ...cita, estado: newStatus }
            : cita
        )
      );

      // Actualizar estadísticas
      fetchMedicalData();
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Today's Schedule */}
      <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Agenda de Hoy</h2>
          <div className="text-sm text-gray-600">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        
        <div className="space-y-4">
          {todayAppointments.length > 0 ? (
            todayAppointments.map((appointment) => (
              <div 
                key={appointment.id_cita_medica} 
                className={`flex items-center justify-between p-4 rounded-md ${
                  appointment.estado === 'Completada' 
                    ? 'bg-green-50 border-l-4 border-green-500' 
                    : appointment.estado === 'En Progreso'
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'bg-gray-50 border-l-4 border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <div className="mr-4">
                    <div className="text-sm font-medium">
                      {new Date(appointment.fecha_hora_programada).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">
                      {appointment.paciente?.persona?.prenombres} {appointment.paciente?.persona?.primer_apellido} {appointment.paciente?.persona?.segundo_apellido}
                    </div>
                    <div className="text-sm text-gray-500">
                      Estado: {appointment.estado}
                    </div>
                  </div>
                </div>
                <div>
                  {appointment.estado === 'Programada' && (
                    <button 
                      onClick={() => updateAppointmentStatus(appointment.id_cita_medica, 'En Progreso')}
                      className="px-3 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                    >
                      Iniciar atención
                    </button>
                  )}
                  {appointment.estado === 'En Progreso' && (
                    <button 
                      onClick={() => updateAppointmentStatus(appointment.id_cita_medica, 'Completada')}
                      className="px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200"
                    >
                      Completar
                    </button>
                  )}
                  {appointment.estado === 'Completada' && (
                    <span className="px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                      Completada
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p>No tienes citas programadas para hoy</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions and Stats */}
      <div className="col-span-1 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Acciones Rápidas</h2>
          
          <div className="space-y-3">
            <Link
              to='/medical-services'
              className="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <Stethoscope className="h-5 w-5 mr-2" />
              Registrar Servicio Médico
            </Link>

            <Link
              to='/medical-records'
              className="w-full py-3 px-4 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              <FileText className="h-5 w-5 mr-2" />
              Ver Historiales
            </Link>

            <button className="w-full py-3 px-4 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors flex items-center justify-center">
              <Clock className="h-5 w-5 mr-2" />
              Gestionar Horarios
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Resumen del Día</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="text-2xl font-bold text-blue-700">{stats.citasHoy}</div>
              <div className="text-sm text-blue-700">Citas programadas</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-md">
              <div className="text-2xl font-bold text-green-700">{stats.citasCompletadas}</div>
              <div className="text-sm text-green-700">Completadas</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-md">
              <div className="text-2xl font-bold text-yellow-700">{stats.citasPendientes}</div>
              <div className="text-sm text-yellow-700">Pendientes</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-md">
              <div className="text-2xl font-bold text-purple-700">{stats.serviciosHoy}</div>
              <div className="text-sm text-purple-700">Servicios hoy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;