function getLang(req) {
  const raw = String(req.headers["x-lang"] || "").toLowerCase();
  return raw === "ru" ? "ru" : "uz";
}

const messages = {
  invalidCredentials: {
    uz: "Email yoki parol noto'g'ri",
    ru: "Неверный email или пароль"
  },
  requiredFields: {
    uz: "Barcha maydonlar majburiy!",
    ru: "Все поля обязательны!"
  },
  invalidEmail: {
    uz: "Iltimos, to'g'ri email manzil kiriting.",
    ru: "Введите корректный email."
  },
  invalidUsername: {
    uz: "Foydalanuvchi nomi 3-15 belgidan iborat bo'lishi va faqat harf, raqam yoki pastki chiziqdan iborat bo'lishi kerak.",
    ru: "Имя пользователя должно быть длиной 3-15 символов и содержать только буквы, цифры или нижнее подчеркивание."
  },
  invalidPassword: {
    uz: "Parol kamida 8 ta belgidan iborat bo'lishi, kamida bitta katta harf va bitta raqamni o'z ichiga olishi kerak.",
    ru: "Пароль должен быть не менее 8 символов и содержать минимум одну заглавную букву и одну цифру."
  },
  emailTaken: {
    uz: "Bu email allaqachon band.",
    ru: "Этот email уже используется."
  },
  ipTaken: {
    uz: "Bu tarmoqdan allaqachon akkaunt yaratilgan.",
    ru: "С этой сети уже зарегистрирован аккаунт."
  },
  authRequired: {
    uz: "Autentifikatsiya talab qilinadi",
    ru: "Требуется аутентификация"
  },
  invalidToken: {
    uz: "Token yaroqsiz",
    ru: "Недействительный токен"
  },
  wrongCurrentPassword: {
    uz: "Joriy parol noto'g'ri",
    ru: "Текущий пароль неверный"
  },
  invalidProfileLink: {
    uz: "Profil havolasi kamida 4 ta belgidan iborat bo'lishi va faqat harf, raqam yoki pastki chiziqdan iborat bo'lishi kerak.",
    ru: "Ссылка профиля должна быть не короче 4 символов и содержать только буквы, цифры или нижнее подчеркивание."
  },
  profileLinkTaken: {
    uz: "Bu profil havolasi allaqachon band.",
    ru: "Эта ссылка профиля уже занята."
  },
  serverProblem: {
    uz: "Server bilan muammo yuz berdi.",
    ru: "РџСЂРѕРёР·РѕС€Р»Р° РїСЂРѕР±Р»РµРјР° СЃ СЃРµСЂРІРµСЂРѕРј."
  }
};

function t(req, key) {
  const lang = getLang(req);
  const item = messages[key];
  if (!item) return key;
  return item[lang] || item.uz;
}

module.exports = { getLang, t };
