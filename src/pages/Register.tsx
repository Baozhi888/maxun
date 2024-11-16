import axios from "axios";
import { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/auth";
import { Box, Typography, TextField, Button, CircularProgress } from "@mui/material";
import { useGlobalInfoStore } from "../context/globalInfo";
import { apiUrl } from "../apiConfig";

const Register = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const { notify } = useGlobalInfoStore();
  const { email, password } = form;

  const { state, dispatch } = useContext(AuthContext);
  const { user } = state;

  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const submitForm = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${apiUrl}/auth/register`, {
        email,
        password,
      });
      dispatch({ type: "LOGIN", payload: data });
      notify("success", "Registration Successful!");
      window.localStorage.setItem("user", JSON.stringify(data));
      navigate("/");
    } catch (err) {
      notify("error", "Registration Failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxHeight: "100vh",
        mt: 6,
        padding: 4,
      }}
    >
      <Box
        component="form"
        onSubmit={submitForm}
        sx={{
          textAlign: "center",
          maxWidth: 400,
          width: "100%",
          backgroundColor: "#ffffff",
          padding: 4,
          borderRadius: 4,
          boxShadow: "0px 0px 20px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <img src="../src/assets/maxunlogo.png" alt="logo" height={55} width={60} style={{ marginBottom: 20, borderRadius: "20%", alignItems: "center" }} />
        <Typography variant="h4" gutterBottom>
          Create an Account
        </Typography>
        <TextField
          fullWidth
          label="Email"
          name="email"
          value={email}
          onChange={handleChange}
          margin="normal"
          variant="outlined"
          required
          sx={{
            "& .MuiOutlinedInput-root": {
              backgroundColor: email ? "#ffe6f9" : "#ffffff",
              "& fieldset": { borderColor: "#ff33cc" },
              "&:hover fieldset": { borderColor: "#ff33cc" },
              "&.Mui-focused fieldset": { borderColor: "#ff33cc" },
            },
            "& input:-webkit-autofill": {
              WebkitBoxShadow: "0 0 0 1000px #ffe6f9 inset",
              WebkitTextFillColor: "#000",
            },
            "& .MuiInputLabel-root": { color: email ? "#ff33cc" : "#000000" },
            "& .MuiInputLabel-root.Mui-focused": { color: "#ff33cc" },
          }}
        />
        <TextField
          fullWidth
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={handleChange}
          margin="normal"
          variant="outlined"
          required
          sx={{
            "& .MuiOutlinedInput-root": {
              backgroundColor: password ? "#ffe6f9" : "#ffffff",
              "& fieldset": { borderColor: "#ff33cc" },
              "&:hover fieldset": { borderColor: "#ff33cc" },
              "&.Mui-focused fieldset": { borderColor: "#ff33cc" },
            },
            "& input:-webkit-autofill": {
              WebkitBoxShadow: "0 0 0 1000px #ffe6f9 inset",
              WebkitTextFillColor: "#000",
            },
            "& .MuiInputLabel-root": { color: password ? "#ff33cc" : "#000000" },
            "& .MuiInputLabel-root.Mui-focused": { color: "#ff33cc" },
          }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          color="primary"
          sx={{ mt: 2, mb: 2 }}
          disabled={loading || !email || !password}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 2 }} />
              Loading
            </>
          ) : (
            "Register"
          )}
        </Button>
        <Typography variant="body2" align="center">
          Already have an account?{" "}
          <Link to="/login" style={{ textDecoration: "none", color: "#ff33cc" }}>
            Login
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Register;
