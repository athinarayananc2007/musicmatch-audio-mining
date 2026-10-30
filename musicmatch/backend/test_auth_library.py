import unittest
import json
from app import app
from database import init_db

class TestAuthAndSessionLibrary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

    def test_auth_and_session_flow(self):
        import time
        unique_user = f"tester_{int(time.time())}"
        email = f"{unique_user}@example.com"
        password = "password123"

        # 1. Register
        reg_res = self.client.post("/api/auth/register", json={
            "username": unique_user,
            "email": email,
            "password": password
        })
        self.assertEqual(reg_res.status_code, 201)
        reg_data = reg_res.get_json()
        self.assertEqual(reg_data["status"], "success")
        token = reg_data["token"]
        self.assertTrue(bool(token))

        # 2. Get Profile (/api/auth/me)
        me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertEqual(me_data["user"]["username"], unique_user)

        # 3. List empty sessions
        sess_res = self.client.get("/api/user/sessions", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(sess_res.status_code, 200)
        self.assertEqual(sess_res.get_json()["sessions"], [])

        # 4. Link and populate a test session with songs
        test_session_id = f"sess_{unique_user}"
        from database import save_songs
        sample_songs_data = [
            {"name": "test_track_1.mp3", "features": [0.1]*18, "tempo": 120.0, "spectral_centroid": 1500.0, "chroma_mean": 0.3, "zcr_mean": 0.05, "rms_mean": 0.1},
            {"name": "test_track_2.mp3", "features": [0.2]*18, "tempo": 130.0, "spectral_centroid": 2000.0, "chroma_mean": 0.4, "zcr_mean": 0.06, "rms_mean": 0.15},
            {"name": "test_track_3.mp3", "features": [0.3]*18, "tempo": 140.0, "spectral_centroid": 2500.0, "chroma_mean": 0.5, "zcr_mean": 0.07, "rms_mean": 0.2},
        ]
        sample_enriched = [
            {"name": "test_track_1.mp3", "tempo": 120.0, "spectral_centroid": 1500.0, "chroma_mean": 0.3, "zcr_mean": 0.05, "rms_mean": 0.1, "cluster": 0, "pca_x": 0.5, "pca_y": -0.2, "original_index": 0},
            {"name": "test_track_2.mp3", "tempo": 130.0, "spectral_centroid": 2000.0, "chroma_mean": 0.4, "zcr_mean": 0.06, "rms_mean": 0.15, "cluster": 1, "pca_x": -0.3, "pca_y": 0.8, "original_index": 1},
            {"name": "test_track_3.mp3", "tempo": 140.0, "spectral_centroid": 2500.0, "chroma_mean": 0.5, "zcr_mean": 0.07, "rms_mean": 0.2, "cluster": 1, "pca_x": 0.1, "pca_y": 0.4, "original_index": 2},
        ]
        save_songs(test_session_id, sample_songs_data, sample_enriched)

        link_res = self.client.post("/api/auth/link-session", 
                                    headers={"Authorization": f"Bearer {token}"},
                                    json={"session_id": test_session_id})
        self.assertEqual(link_res.status_code, 200)

        # 5. List user sessions (should now contain 1 session with 3 songs)
        user_sess_res = self.client.get("/api/user/sessions", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(user_sess_res.status_code, 200)
        sessions_list = user_sess_res.get_json()["sessions"]
        self.assertEqual(len(sessions_list), 1)
        self.assertEqual(sessions_list[0]["session_id"], test_session_id)
        self.assertEqual(sessions_list[0]["song_count"], 3)

        # 6. Restore session
        restore_res = self.client.post(f"/api/user/sessions/{test_session_id}/restore",
                                       headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(restore_res.status_code, 200)
        restore_data = restore_res.get_json()
        self.assertEqual(restore_data["status"], "success")
        self.assertEqual(restore_data["total_analyzed"], 3)
        self.assertEqual(len(restore_data["songs"]), 3)

        # 7. Delete session
        del_res = self.client.delete(f"/api/user/sessions/{test_session_id}",
                                     headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(del_res.status_code, 200)

        # 8. Verify list is empty again
        user_sess_res2 = self.client.get("/api/user/sessions", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(len(user_sess_res2.get_json()["sessions"]), 0)

        # 9. Login test
        login_res = self.client.post("/api/auth/login", json={
            "username": unique_user,
            "password": password
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertEqual(login_data["status"], "success")
        self.assertTrue("token" in login_data)

if __name__ == "__main__":
    unittest.main()
