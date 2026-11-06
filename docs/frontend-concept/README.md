# 🎨 Frontend design concept

A frontend concept for **Voice to Help**, called *Hilfe-Navigator* on screen, designed by **Aryan Thakkar** during the InclusivAI Hackathon on 29 October 2026.

It was finished too late to become part of the submitted build, so this folder only **shares the design as screenshots**. No code from it is in this repository.

The concept is a working web page built for the backend's `POST /talk` API. The screenshots were taken in its test mode.

> [!NOTE]
> Everything in the screenshots is test data: the conversations, the service, the contact person, the address, the phone number and the e-mail are made-up examples. The only real numbers are the emergency number 112 and the Telefonseelsorge crisis line 0800 111 0 111.

## ✨ Ideas in this design

- **One press, then hands-free.** After the first press the page listens again after every answer, so nobody has to keep pressing. A short pause sends the answer.
- **Three clear steps:** *Erzählen* (tell), *Nachfragen* (questions), *Passende Stelle* (matching service).
- **A contact person, not just an address.** The result card names the person to ask for and has a large call button.
- **Ends only when the person is done.** After the answer it asks *„Möchten Sie das Gespräch beenden?“* (Do you want to end the conversation?), answered by voice or with a button.
- **Easy to read for older people:** German and English, text size up to 200%, large buttons, captions for everything that is said, Caritas red and the Inter house font.
- **Safety stays visible:** the notice with 112 and the Telefonseelsorge is shown in every state.

## 📱 Phone

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <img src="web-app/01-start.png" width="250" alt="Start screen on a phone: Caritas logo and the title Hilfe-Navigator, buttons for language and text size, the notice with 112 and the Telefonseelsorge, three steps and a large red Sprechen (speak) button">
      <br><b>1 · Start</b><br>One button to begin
    </td>
    <td align="center" valign="top" width="33%">
      <img src="web-app/02-listening.png" width="250" alt="Listening: a dark red Fertig (done) button inside a light ring that grows with the voice, a timer and a button to end the conversation">
      <br><b>2 · Listening</b><br>Hands-free after the first press
    </td>
    <td align="center" valign="top" width="33%">
      <img src="web-app/03-service-contact-person.png" width="250" alt="Result card: Diese Stelle kann Ihnen helfen (this service can help you), the service name, the contact person, why it fits and a large red call button">
      <br><b>3 · Matching service</b><br>Contact person and call button
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <img src="web-app/04-end-question.png" width="250" alt="End question: Möchten Sie das Gespräch beenden? (do you want to end the conversation?) with yes and no buttons, while the page keeps listening for a spoken answer">
      <br><b>4 · End question</b><br>Answer by voice or button
    </td>
    <td align="center" valign="top">
      <img src="web-app/05-large-text-english.png" width="250" alt="English version at 175% text size: the Help Navigator header, language and text size buttons and the notice in large type">
      <br><b>5 · Large text, English</b><br>Text size up to 200%
    </td>
    <td></td>
  </tr>
</table>

## 🖥️ Desktop

<img src="web-app/06-desktop.png" width="760" alt="Desktop view: the header with logo, language and text size buttons, the notice, and the conversation shown as captions with a Nochmal anhören (listen again) button under the answer">

**6 · Desktop:** the conversation is shown as captions, and every answer can be played again.
