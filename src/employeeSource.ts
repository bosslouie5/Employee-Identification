export type Employee = {
  status: string;
  id: string;
  fullName: string;
  positionTitle: string;
  department: string;
  subDepartment: string;
  costCentreCode: string;
  phoneNumber: string;
  emailAddress: string;
  gender: string;
  reportsTo: string;
  companyName: string;
  companyCode: string;
  companyDisplay: string;
  role: string;
  location: string;
  photoUrl: string;
  idPhoto1: string;
  idPhoto2: string;
  pdfFile: string;
  qrCodeData: string;
};

export const employees: Employee[] = [
  {
    status: 'Active',
    id: '50001234',
    fullName: 'Aileen Santos',
    positionTitle: 'Staff Coordinator',
    department: 'HR & Admin',
    subDepartment: 'People Operations',
    costCentreCode: 'CC-101',
    phoneNumber: '+63 912 345 6789',
    emailAddress: 'aileen.santos@example.com',
    gender: 'Female',
    reportsTo: 'Ana Cruz',
    companyName: 'MTS',
    companyCode: '5000',
    companyDisplay: 'MTS (5000-MTS)',
    role: 'Staff Coordinator',
    location: 'Makati HQ',
    photoUrl: '',
    idPhoto1: '',
    idPhoto2: '',
    pdfFile: '',
    qrCodeData: '50001234',
  },
  {
    status: 'Active',
    id: '51001234',
    fullName: 'Miguel Reyes',
    positionTitle: 'Systems Analyst',
    department: 'IT Operations',
    subDepartment: 'Infrastructure',
    costCentreCode: 'CC-202',
    phoneNumber: '+63 917 654 3210',
    emailAddress: 'miguel.reyes@example.com',
    gender: 'Male',
    reportsTo: 'Joan Delacruz',
    companyName: 'MTS',
    companyCode: '5000',
    companyDisplay: 'MTS (5000-MTS)',
    role: 'Systems Analyst',
    location: 'BGC Campus',
    photoUrl: '',
    idPhoto1: '',
    idPhoto2: '',
    pdfFile: '',
    qrCodeData: '51001234',
  },
];

export function searchEmployees(items: Employee[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) =>
    [
      item.status,
      item.id,
      item.fullName,
      item.positionTitle,
      item.department,
      item.subDepartment,
      item.costCentreCode,
      item.phoneNumber,
      item.emailAddress,
      item.gender,
      item.reportsTo,
      item.companyName,
      item.companyDisplay,
      item.role,
      item.location,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  );
}
