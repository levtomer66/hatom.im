'use client';

import React from 'react';
import { motion } from 'framer-motion';

const GreetingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 py-12 px-4" dir="rtl">
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 text-center">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h1 className="text-4xl font-bold text-purple-600 mb-6">
              🎉 יום הולדת שמח! 🎂
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-6"
          >
            <p className="text-xl text-gray-700 leading-relaxed">
            לתומית הארוסה ההורסת שלי 💍❤️
            </p>
            <p className="text-lg text-gray-600">
היום הזה הוא מאד מיוחד כי ✨<br />
זה התומיתולדת הראשון והאחרון שלנו כארוס וארוסה! 🎉🥳<br />
קודם כל אני מאחל לך המון המון מזל טוב!! 🎂🎈🎁<br />
ולנו אני מאחל עוד מלא שנים של אהבה אינסופית 💕 - אוכל 🍣, טיולים ✈️, עוגות 🍰, גסויות 🤭,<br />
קפה בשישי ☕, הצעות נישואין יומיות 💍, לראות את כל האולמות (אבל הכי לאהוב את זה שבחרנו) 🎊,<br />
להכין אקסלים 📊, לעשות הופעות 🎤, ללכת להופעות 🎶, לשנוא כוסברה ביחד 🤢<br />
והכי חשוב - ולהמציא לרבון טריליון שמות!! 🐶💛<br /><br />

מקווה שאת מוכנה להתחיל איתי את החיים 🚀<br />
את תכיני אוכל 🍳 ואני אכין לך אתרים 🖥️<br />
ביחד נקפקף בכל פינה בעיר 🏙️<br />
ניתן ציונים לפי ההקצפה והמחיר ☕💰<br /><br />

תומית אוהבת פודקאסטים על רוצחים 🔪🎧<br />
תומרי אוהב לשחק במחשבים 💻🕹️<br />
אך דבר אחד הם אוהבים במשותף<br />
לקייק ולהגיד שיצא ענק  💩🔥<br /><br />

את תומית אני אוהב אז קניתי לה טבעת 💍❤️<br />
כוסית בטירוף, אותי היא משגעת 🤩<br />
מרימה משקולות הכי חזקה בעולם 💪🏋️‍♀️<br />
עד החתונה תשקול 20 קילוגרם 🪶<br /><br />

ביחד נעשה דברים משוגעים 🤪<br />
נלך לזונות, נעשן סמים ונתמכר להימורים 🤯<br />
אמא מדהימה שרבון קיבל מהשמיים 🐶✨<br />
אם לא הייתי קמצן הייתי מתחתן איתה פעמיים! 💕👰💒
            </p>
            
            <div className="py-6">
              <motion.div
                animate={{ 
                  rotate: [0, 5, -5, 5, 0],
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="text-5xl"
              >
                🎈 🎁 🎊
              </motion.div>
            </div>
            
            <p className="text-lg text-purple-500 font-semibold">
              אוהב
              <br />
              תומרינדי
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default GreetingPage; 