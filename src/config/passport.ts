  // src/config/passport.ts
  import passport from 'passport';
  import { Strategy as LocalStrategy } from 'passport-local';
  import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
  // Inside src/config/passport.ts
  import User, { IUser } from '../models/user';
  import dotenv from 'dotenv';

  dotenv.config();

  const JWT_SECRET = process.env.JWT_SECRET;  

  if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env file.');
    process.exit(1);
  }

  // --- Local Strategy (Username/Password Login) ---
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email', // We're using email as the username
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          // Find the user by email. Explicitly select password as it's hidden by default.
          const user: IUser | null = await User.findOne({ email }).select('+password');

          if (!user) {
            return done(null, false, { message: 'Incorrect email or password.' });
          }

          // User found, now compare password
          // Ensure user.password exists before calling comparePassword
          if (!user.password) {
              return done(null, false, { message: 'User password not set.' });
          }
          const isMatch = await user.comparePassword(password);

          if (!isMatch) {
            return done(null, false, { message: 'Incorrect email or password.' });
          }

          // Passwords match, return the user object (without password)
          // Create a user object without password to pass to done
          const userToReturn = user.toObject();
          delete userToReturn.password;
          return done(null, userToReturn);

        } catch (error) {
          return done(error); // Pass errors to Passport
        }
      }
    )
  );

  // --- JWT Strategy (Token-based Authentication) ---
  const jwtOptions: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extracts token from "Bearer <token>" in Authorization header
    secretOrKey: JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(jwtOptions, async (payload, done) => {
      try {
        // payload.sub should be the user ID we stored in the JWT
        const user: IUser | null = await User.findById(payload.sub);

        if (user) {
          return done(null, user); // User found, pass to next middleware
        } else {
          return done(null, false); // User not found
        }
      } catch (error) {
        return done(error, false);
      }
    })
  );


  export default passport;