'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Settings, Users, Building2, Globe, Key, Bell, Database, Shield } from 'lucide-react'

const users = [
  { id: '1', name: 'Juan Manuel Mocciaro', email: 'jmocciaro@gmail.com', role: 'admin', active: true },
  { id: '2', name: 'Facundo', email: 'facu@torquetools.es', role: 'vendedor', active: true },
  { id: '3', name: 'Norberto', email: 'norber@torquetools.es', role: 'vendedor', active: true },
  { id: '4', name: 'Jano', email: 'jano@torquetools.es', role: 'vendedor', active: true },
]

const companies = [
  { id: '1', name: 'TorqueTools SL', country: 'ES', currency: 'EUR', tax: '21%', active: true },
  { id: '2', name: 'BuscaTools SA', country: 'AR', currency: 'ARS', tax: '21%', active: true },
  { id: '3', name: 'Torquear SA', country: 'AR', currency: 'ARS', tax: '21%', active: true },
  { id: '4', name: 'Global Assembly Solutions LLC', country: 'US', currency: 'USD', tax: '0%', active: true },
]

const tabs = [
  { id: 'users', label: 'Usuarios', icon: <Users size={16} /> },
  { id: 'companies', label: 'Empresas', icon: <Building2 size={16} /> },
  { id: 'params', label: 'Parámetros', icon: <Settings size={16} /> },
  { id: 'security', label: 'Seguridad', icon: <Shield size={16} /> },
]

export default function AdminPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Administración</h1>
        <p className="text-[#6B7280] mt-1">Configuración del sistema</p>
      </div>

      <Tabs tabs={tabs} defaultTab="users">
        {(activeTab) => (
          <>
            {/* USERS TAB */}
            {activeTab === 'users' && (
              <Card>
                <CardHeader>
                  <CardTitle>Usuarios del sistema</CardTitle>
                  <Button variant="primary" size="sm"><Users size={14} /> Nuevo Usuario</Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#FF6600] flex items-center justify-center text-white text-xs font-bold">
                                {user.name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-[#F0F2F5]">{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-[#9CA3AF]">{user.email}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'orange' : 'default'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="success">Activo</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">Editar</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* COMPANIES TAB */}
            {activeTab === 'companies' && (
              <Card>
                <CardHeader>
                  <CardTitle>Empresas del grupo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {companies.map(company => (
                      <div key={company.id} className="p-4 rounded-xl bg-[#0F1218] border border-[#1E2330] hover:border-[#2A3040] transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-[#F0F2F5]">{company.name}</h3>
                          <Badge variant="success">Activa</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-[#6B7280]">País</p>
                            <p className="text-sm text-[#D1D5DB]">{company.country}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#6B7280]">Moneda</p>
                            <p className="text-sm text-[#D1D5DB]">{company.currency}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#6B7280]">IVA</p>
                            <p className="text-sm text-[#D1D5DB]">{company.tax}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="mt-3 w-full">Configurar</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PARAMS TAB */}
            {activeTab === 'params' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Parámetros Generales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="Moneda por defecto" value="EUR" readOnly />
                      <Input label="IVA por defecto (%)" value="21" type="number" />
                      <Input label="Días de validez cotizaciones" value="30" type="number" />
                      <Input label="Margen por defecto (%)" value="30" type="number" />
                    </div>
                    <Button variant="primary" size="sm">Guardar cambios</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Integraciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { name: 'Gmail', status: 'Configurado', connected: true },
                        { name: 'WhatsApp Business', status: 'Pendiente', connected: false },
                        { name: 'Tango Gestión', status: 'Pendiente', connected: false },
                      ].map(integration => (
                        <div key={integration.name} className="flex items-center justify-between p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                          <div>
                            <p className="text-sm font-medium text-[#F0F2F5]">{integration.name}</p>
                            <p className="text-xs text-[#6B7280]">{integration.status}</p>
                          </div>
                          <Badge variant={integration.connected ? 'success' : 'default'}>
                            {integration.connected ? 'Conectado' : 'Desconectado'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <Card>
                <CardHeader>
                  <CardTitle>Seguridad y Permisos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                      <h4 className="text-sm font-semibold text-[#F0F2F5] mb-2">Roles del sistema</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded bg-[#141820]">
                          <div>
                            <Badge variant="orange">Admin</Badge>
                            <span className="text-xs text-[#6B7280] ml-2">Acceso total al sistema</span>
                          </div>
                          <span className="text-xs text-[#4B5563]">1 usuario</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-[#141820]">
                          <div>
                            <Badge variant="info">Vendedor</Badge>
                            <span className="text-xs text-[#6B7280] ml-2">Cotizaciones, clientes, CRM</span>
                          </div>
                          <span className="text-xs text-[#4B5563]">3 usuarios</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-[#141820]">
                          <div>
                            <Badge variant="default">Viewer</Badge>
                            <span className="text-xs text-[#6B7280] ml-2">Solo lectura</span>
                          </div>
                          <span className="text-xs text-[#4B5563]">0 usuarios</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center py-8 text-[#4B5563] border border-dashed border-[#1E2330] rounded-lg">
                      <div className="text-center">
                        <Key size={24} className="mx-auto mb-2" />
                        <p className="text-sm">Configuración avanzada de permisos</p>
                        <p className="text-xs mt-1">Próximamente</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
