import { createContext, useContext, useState } from 'react';
import bcrypt from 'bcryptjs';
import { Hs_usersService } from '../generated/services/Hs_usersService';
import { Hs_usershs_userrole } from '../generated/models/Hs_usersModel';

const AuthContext = createContext(null);

function toAppUser(record) {
  return {
    id: record.hs_userid,
    name: record.hs_fullname,
    email: record.hs_emailaddress,
    role: Hs_usershs_userrole[record.hs_userrole] ?? record.hs_userrole,
    nhsId: record.hs_nhsidentifier,
    phone: record.hs_phonenumber,
    dateOfBirth: record.hs_dateofbirth,
    gender: record.hs_gender,
    bloodType: record.hs_bloodtype,
    profileImage: record.hs_profileimageurl,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading] = useState(false);

  const login = async (email, password) => {
    const escapedEmail = email.replace(/'/g, "''");
    const result = await Hs_usersService.getAll({
      filter: `hs_emailaddress eq '${escapedEmail}'`,
    });
    const record = result.data?.[0];
    if (!record || !record.hs_passwordhash || !bcrypt.compareSync(password, record.hs_passwordhash)) {
      throw new Error('Invalid email or password');
    }

    const loggedInUser = toAppUser(record);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updated) => {
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
