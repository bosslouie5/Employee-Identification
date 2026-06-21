export type Employee = {
  status: string;
  id: string;
  fullName: string;
  positionTitle: string;
  department: string;
  subDepartment: string;
  division: string;
  companyName: string;
  location: string;
  nationality: string;
  dateOfBirth: string;
  homePage: string;
  emailAddress: string;
  gender: string;
  reportsTo: string;
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
    division: 'People Experience',
    companyName: 'Masdar',
    location: 'Abu Dhabi',
    nationality: 'Filipino',
    dateOfBirth: '18-Jun-1991',
    homePage: 'http://www.masdar.co',
    emailAddress: 'aileen.santos@example.com',
    gender: 'Female',
    reportsTo: 'Ana Cruz',
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
    division: 'Digital Services',
    companyName: 'Masdar',
    location: 'Dubai',
    nationality: 'Filipino',
    dateOfBirth: '04-Nov-1988',
    homePage: 'http://www.masdar.co',
    emailAddress: 'miguel.reyes@example.com',
    gender: 'Male',
    reportsTo: 'Joan Delacruz',
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
      item.division,
      item.companyName,
      item.location,
      item.nationality,
      item.emailAddress,
      item.gender,
      item.reportsTo,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  );
}
