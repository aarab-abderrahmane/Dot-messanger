/*
АНАЛИЗ ЛОГИКИ ДРУЖБЫ - BUG REPORT

СЦЕНАРИЙ:
User A отправляет запрос дружбы User B
User B не может подтвердить

АНАЛИЗ КОДА:

1. User A выполняет sendRequest(A, B):
   - Проверка: hasPendingRequest(B, A)? -> Нет
   - Вставляет: contact_requests(sender=A, recipient=B)
   
2. User B (на другом компьютере) выполняет acceptRequest(B, A):
   - Вызывает: acceptContactRequest(B, A)
   - Функция ищет: hasPendingRequest(A, B)? -> ДА!
   - Должна удалить запрос и создать взаимные контакты

ПРОБЛЕМА В contactController.js строка 48:
const sender = findUserByIdentifier(req.body?.query);
^-- Это должен быть тот кто ОТПРАВИЛ запрос

Но в acceptRequest вызывается:
acceptContactRequest(req.user.email, sender.email)
^-- req.user это тот кто ПРИНИМАЕТ
^-- sender это тот кого мы нашли по query

НЕПРАВИЛЬНОСТЬ:
- Если req.user = B (тот кто принимает) и находим sender = A (из query)
- То вызов: acceptContactRequest(B, A) 
- Но функция ожидает: acceptContactRequest(recipientEmail, senderEmail)
- Что означает: acceptContactRequest(B, A) = (recipient=B, sender=A)
- Но в базе запрос хранится как (sender=A, recipient=B)!

ПРАВИЛЬНО ДОЛЖНО БЫТЬ:
- acceptContactRequest(sender.email, req.user.email)
- acceptContactRequest(A, B) = (recipient=A, sender=B) ??? НЕТ!

СТОП, ПЕРЕОСМЫСЛЯЮ:
Функция acceptContactRequest(recipientEmail, senderEmail) проверяет:
hasPendingRequest(senderEmail, recipientEmail)
^-- ищет запрос где sender_email=senderEmail и recipient_email=recipientEmail

Если мы вызываем acceptContactRequest(B, A):
- recipientEmail = B (тот кто принимает)
- senderEmail = A (тот кто отправил)
- Ищет: hasPendingRequest(A, B) = есть ли запрос(sender=A, recipient=B)? ДА!
- Удаляет и создает контакты

ВЫВОД: В contactController вызов правильный!
Ошибка была только в contactStore.js строка 100!
*/
